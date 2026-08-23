import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb, seedActiveUser } from '../../support/seed';
import { fakeSsoProvider, SSO_EMAILS, SSO_SUBJECTS } from '../../support/sso';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const PASSWORD = 'SecurePass123!';

/**
 * Back-channel logout — the identity provider telling the CMS, with no browser
 * involved, that a session on its side has ended.
 *
 * This is the answer to the one thing operators assume SSO already does. A
 * session here is a row with a TTL, and disabling somebody in the directory
 * does not reach it; until this route existed the honest answer to "we
 * offboarded them, are they out?" was "within `SESSION_TTL_SECONDS`".
 */
describe('SSO back-channel logout', () => {
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
        await seedActiveUser(harness.app, {
            email: SSO_EMAILS.linked,
            password: PASSWORD,
            role: 'contributor'
        });
    });

    /** Sign in through the scripted provider and return the signed-in agent. */
    async function signInWithSso() {
        const agent = request.agent(harness.server);
        const started = await agent
            .get('/api/auth/sso/fake/start')
            .expect(302);
        const location = new URL(started.headers['location']);
        await agent
            .get(`${location.pathname}${location.search}`)
            .expect(302);
        await agent.get('/api/auth/me').expect(200);
        return agent;
    }

    /** Post a notification the scripted provider will vouch for. */
    function notify(token: string) {
        return request(harness.server)
            .post('/api/auth/sso/fake/backchannel-logout')
            .type('form')
            .send({ logout_token: token });
    }

    it('ends the sessions one provider session opened', async () => {
        const agent = await signInWithSso();

        const response = await notify(
            fakeSsoProvider.logoutToken({
                sessionId: `fake-session-${SSO_SUBJECTS.linked}`
            })
        ).expect(200);

        expect(response.body).toEqual({ revoked: 1 });
        // The session is gone the moment the provider said so, not when its
        // TTL runs out.
        await agent.get('/api/auth/me').expect(401);
    });

    it('ends every session the account holds when told only the subject', async () => {
        const first = await signInWithSso();
        const second = await signInWithSso();

        const response = await notify(
            fakeSsoProvider.logoutToken({ subject: SSO_SUBJECTS.linked })
        ).expect(200);

        expect(response.body.revoked).toBeGreaterThanOrEqual(2);
        await first.get('/api/auth/me').expect(401);
        await second.get('/api/auth/me').expect(401);
    });

    it('leaves a password session alone — it was never the provider\'s to end', async () => {
        const password = request.agent(harness.server);
        await password
            .post('/api/auth/login')
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ email: SSO_EMAILS.linked, password: PASSWORD })
            .expect(201);
        const sso = await signInWithSso();

        await notify(
            fakeSsoProvider.logoutToken({
                sessionId: `fake-session-${SSO_SUBJECTS.linked}`
            })
        ).expect(200);

        await sso.get('/api/auth/me').expect(401);
        await password.get('/api/auth/me').expect(200);
    });

    it('refuses an unverified notification', async () => {
        // The route is unauthenticated and reachable by anyone. Without
        // verification it would be an open way to sign arbitrary people out.
        const agent = await signInWithSso();

        await notify('not-a-real-token').expect(400);

        await agent.get('/api/auth/me').expect(200);
    });

    it('refuses a request with no token at all', async () => {
        await request(harness.server)
            .post('/api/auth/sso/fake/backchannel-logout')
            .type('form')
            .send({})
            .expect(400);
    });

    it('is idempotent, because providers retry', async () => {
        await signInWithSso();
        const token = fakeSsoProvider.logoutToken({
            sessionId: `fake-session-${SSO_SUBJECTS.linked}`
        });

        await notify(token).expect(200);
        const second = await notify(token).expect(200);

        // Still `200`, and honestly zero: a retry must not report the same
        // sessions revoked twice.
        expect(second.body).toEqual({ revoked: 0 });
    });

    it('says nothing about a subject with no account here', async () => {
        // A provider legitimately notifies about people who never signed in.
        // Answering anything but "fine, nothing to do" would make this an
        // oracle for which of a directory's members hold accounts in this CMS.
        const response = await notify(
            fakeSsoProvider.logoutToken({ subject: 'somebody-we-never-saw' })
        ).expect(200);

        expect(response.body).toEqual({ revoked: 0 });
    });

    it('404s for a provider nobody registered', async () => {
        await request(harness.server)
            .post('/api/auth/sso/not-registered/backchannel-logout')
            .type('form')
            .send({ logout_token: 'x' })
            .expect(404);
    });

    it('tells intermediaries not to cache the answer', async () => {
        // A cached `200` would swallow every later notification.
        const response = await notify(
            fakeSsoProvider.logoutToken({ subject: SSO_SUBJECTS.linked })
        ).expect(200);

        expect(response.headers['cache-control']).toBe('no-store');
    });
});
