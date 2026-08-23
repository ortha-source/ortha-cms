import request from 'supertest';
import { SSO_REQUEST_COOKIE } from '@orthacms/identity-server';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    getUserByEmail,
    resetDb,
    seedActiveUser,
    seedUser,
    setUserEmail,
    setUserStatus,
    sessionRowsContainToken,
    type SeededUser
} from '../../support/seed';
import { fakeSsoProvider, SSO_EMAILS, SSO_SUBJECTS } from '../../support/sso';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const PASSWORD = 'SecurePass123!';

/**
 * The whole SSO handshake, end to end, against a scripted identity provider.
 *
 * The fake is what makes this possible in CI — no tenant, no network, no clock
 * skew — but it is not a stub that says yes: it signs its own responses, so the
 * tampering and replay cases below are refused by real verification code rather
 * than by a flag.
 *
 * The flow a browser performs is reproduced literally. `/start` answers a 302
 * to the provider; because the fake's authorization URL *is* the callback URL,
 * following that redirect is exactly what a real provider's consent screen
 * would eventually do.
 */
describe('SSO sign-in', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });
    afterAll(async () => {
        await closeTestApp(harness);
    });
    beforeEach(async () => {
        await resetDb();
        fakeSsoProvider.signInAs(SSO_SUBJECTS.linked);
    });

    /** Seeds the account the `linked` subject's verified address belongs to. */
    function seedLinkedAccount(): Promise<SeededUser> {
        return seedActiveUser(harness.app, {
            email: SSO_EMAILS.linked,
            password: PASSWORD,
            role: 'contributor'
        });
    }

    /**
     * Runs `/start` and returns the agent (holding the attempt cookie) plus the
     * callback URL the provider redirected to, split into path and query.
     */
    async function start(provider = 'fake', redirect?: string) {
        const agent = request.agent(harness.server);
        const started = await agent
            .get(`/api/auth/sso/${provider}/start`)
            .query(redirect === undefined ? {} : { redirect })
            .expect(302);
        const location = new URL(started.headers['location']);
        return {
            agent,
            setCookie: started.headers['set-cookie'] as unknown as string[],
            callback: `${location.pathname}${location.search}`,
            params: location.searchParams
        };
    }

    describe('the provider list', () => {
        it('is public, and names what is registered', async () => {
            const response = await request(harness.server)
                .get('/api/auth/sso')
                .expect(200);

            expect(response.body).toEqual([
                { name: 'fake', label: 'Fake IdP', kind: 'oidc' }
            ]);
        });
    });

    describe('starting an attempt', () => {
        it('sets a short-lived attempt cookie and redirects to the provider', async () => {
            const { setCookie, params } = await start();

            const attempt = setCookie.find((cookie) =>
                cookie.startsWith(`${SSO_REQUEST_COOKIE}=`)
            );
            expect(attempt).toBeDefined();
            expect(attempt).toContain('HttpOnly');
            // `lax`, never `strict`: the provider returns the person with a
            // top-level cross-site navigation, and a strict cookie is not sent
            // on one.
            expect(attempt?.toLowerCase()).toContain('samesite=lax');
            expect(params.get('state')).toBeTruthy();
        });

        it('sends a PKCE challenge and never the verifier', async () => {
            const { params } = await start();

            expect(params.get('code_challenge_method')).toBe('S256');
            expect(params.get('code_challenge')).toBeTruthy();
            expect(params.get('code_verifier')).toBeNull();
        });

        it('404s for a provider nobody registered', async () => {
            await request(harness.server)
                .get('/api/auth/sso/not-registered/start')
                .expect(404);
        });

        it.each([
            ['an absolute URL', 'https://evil.test/'],
            ['a protocol-relative URL', '//evil.test/'],
            ['a backslash-smuggled host', '/\\evil.test']
        ])('refuses to carry %s as the post-sign-in destination', async (
            _label,
            redirect
        ) => {
            const user = await seedLinkedAccount();
            expect(user.id).toBeTruthy();

            const { agent, callback } = await start('fake', redirect);
            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(`${TEST_ALLOWED_ORIGIN}/`);
        });
    });

    describe('completing an attempt', () => {
        it('signs in an existing account whose verified address matches', async () => {
            const user = await seedLinkedAccount();

            const { agent, callback } = await start('fake', '/entries');
            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(
                `${TEST_ALLOWED_ORIGIN}/entries`
            );

            const me = await agent.get('/api/auth/me').expect(200);
            expect(me.body).toMatchObject({ id: user.id, email: user.email });
        });

        it('opens an ordinary session — indistinguishable from a password one', async () => {
            await seedLinkedAccount();

            const { agent, callback } = await start();
            const done = await agent.get(callback).expect(302);

            const session = (done.headers['set-cookie'] as unknown as string[])
                .find((cookie) => cookie.startsWith('ortha_session='));
            expect(session).toBeDefined();
            expect(session).toContain('HttpOnly');

            const token = session?.split('=')[1].split(';')[0] ?? '';
            // Stored as a hash, never verbatim — the same guarantee the
            // password path gives.
            expect(await sessionRowsContainToken(token)).toBe(false);
        });

        it('clears the attempt cookie, so a spent handle cannot ride along', async () => {
            await seedLinkedAccount();

            const { agent, callback } = await start();
            const done = await agent.get(callback).expect(302);

            const cleared = (done.headers['set-cookie'] as unknown as string[])
                .find((cookie) => cookie.startsWith(`${SSO_REQUEST_COOKIE}=`));
            expect(cleared).toBeDefined();
            expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
        });

        it('links the identity, so the account survives an email change', async () => {
            const user = await seedLinkedAccount();

            const first = await start();
            await first.agent.get(first.callback).expect(302);

            // Move the address the account holds. The provider still reports
            // the old one, so an email-keyed link would now miss — and, worse,
            // would match whoever inherits the address. A subject-keyed link
            // resolves regardless, which is the entire reason for the rule.
            await setUserEmail(user.id, 'renamed-sso-user@example.com');

            const second = await start();
            const done = await second.agent.get(second.callback).expect(302);

            expect(done.headers['location']).toBe(`${TEST_ALLOWED_ORIGIN}/`);
            const me = await second.agent.get('/api/auth/me').expect(200);
            expect(me.body).toMatchObject({
                id: user.id,
                email: 'renamed-sso-user@example.com'
            });
        });
    });

    describe('refusals', () => {
        /** Every refusal lands on the sign-in screen with the same flag. */
        const FAILURE = `${TEST_ALLOWED_ORIGIN}/identity/signin?error=sso`;

        it('refuses a callback with no attempt cookie', async () => {
            await seedLinkedAccount();
            const { callback } = await start();

            // A fresh client: it never held the attempt cookie.
            const done = await request(harness.server)
                .get(callback)
                .expect(302);

            expect(done.headers['location']).toBe(FAILURE);
        });

        it('refuses a replayed callback — the attempt is one-time', async () => {
            await seedLinkedAccount();
            const { agent, callback } = await start();

            await agent.get(callback).expect(302);
            const replay = await request
                .agent(harness.server)
                .get(callback)
                .expect(302);

            expect(replay.headers['location']).toBe(FAILURE);
        });

        it('refuses a foreign state before it exchanges anything', async () => {
            await seedLinkedAccount();
            const { agent, params } = await start();
            const before = fakeSsoProvider.calls().complete;

            const forged = new URLSearchParams(params);
            forged.set('state', 'state-from-somewhere-else');
            const done = await agent
                .get(`/api/auth/sso/fake/callback?${forged.toString()}`)
                .expect(302);

            expect(done.headers['location']).toBe(FAILURE);
            // The state check runs before the adapter is asked to do work, so a
            // forged callback costs one indexed lookup and no round trip.
            expect(fakeSsoProvider.calls().complete).toBe(before);
        });

        it('refuses a tampered response', async () => {
            await seedLinkedAccount();
            const { agent, params } = await start();

            const tampered = new URLSearchParams(params);
            tampered.set('code', 'bm90LXRoZS1zdWJqZWN0');
            const done = await agent
                .get(`/api/auth/sso/fake/callback?${tampered.toString()}`)
                .expect(302);

            expect(done.headers['location']).toBe(FAILURE);
        });

        it('refuses an unverified address, however real the account is', async () => {
            await seedActiveUser(harness.app, {
                email: SSO_EMAILS.unverified,
                password: PASSWORD,
                role: 'contributor'
            });
            fakeSsoProvider.signInAs(SSO_SUBJECTS.unverified);

            const { agent, callback } = await start();
            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(FAILURE);
        });

        it('creates nobody — a verified stranger is still refused', async () => {
            fakeSsoProvider.signInAs(SSO_SUBJECTS.stranger);

            const { agent, callback } = await start();
            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(FAILURE);
            expect(await getUserByEmail(SSO_EMAILS.stranger)).toBeNull();
        });

        it('refuses a disabled account, the same way the password path does', async () => {
            const user = await seedLinkedAccount();
            await setUserStatus(user.id, 'disabled');

            const { agent, callback } = await start();
            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(FAILURE);
        });

        it('refuses a pending invite — accepting it is what makes it an account', async () => {
            await seedUser(harness.app, {
                email: SSO_EMAILS.linked,
                password: PASSWORD,
                role: 'contributor',
                status: 'pending'
            });

            const { agent, callback } = await start();
            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(FAILURE);
        });

        it('refuses when the provider itself declines', async () => {
            await seedLinkedAccount();
            const { agent, callback } = await start();
            fakeSsoProvider.failNextVerification('the user cancelled');

            const done = await agent.get(callback).expect(302);

            expect(done.headers['location']).toBe(FAILURE);
        });
    });
});
