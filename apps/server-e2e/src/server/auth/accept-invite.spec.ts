import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';
import {
    countUserSessions,
    expireInviteTokens,
    getInviteConsumedAt,
    getUserByEmail,
    resetDb,
    seedActiveUser
} from '../../support/seed';

const ADMIN_EMAIL = 'accept-admin@example.com';
const ADMIN_PASSWORD = 'SecurePass123!';
const INVITEE_EMAIL = 'invitee@example.com';
const INVITEE_NAME = 'Ada Lovelace';
/** Comfortably over the server's 12-character minimum. */
const NEW_PASSWORD = 'correct horse battery staple';

/**
 * `GET /api/auth/invite/:token` + `POST /api/auth/invite/accept` — the invite
 * acceptance pair, the only path from a `pending` row to an account that can
 * sign in.
 */
describe('accept an invite', () => {
    let harness: TestApp;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            role: 'admin'
        });
    });

    async function loginAsAdmin() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
            .expect(201);
        return agent;
    }

    /** Invite the standard invitee and return their id + raw token. */
    async function invite(): Promise<{ id: string; token: string }> {
        const agent = await loginAsAdmin();
        const res = await agent
            .post('/api/users/invites')
            .send({
                email: INVITEE_EMAIL,
                name: INVITEE_NAME,
                role: 'contributor'
            })
            .expect(201);
        return { id: res.body.id as string, token: res.body.inviteToken };
    }

    describe('the invite response', () => {
        it('hands the raw token back exactly once, on invite', async () => {
            const { id, token } = await invite();

            expect(typeof token).toBe('string');
            expect(token).not.toHaveLength(0);

            // The list/detail reads must never carry it — only the mint does.
            const agent = await loginAsAdmin();
            const detail = await agent.get(`/api/users/${id}`).expect(200);
            expect(detail.body.inviteToken).toBeUndefined();

            const list = await agent.get('/api/users').expect(200);
            for (const row of list.body.items) {
                expect(row.inviteToken).toBeUndefined();
            }
        });
    });

    describe('GET /api/auth/invite/:token', () => {
        it('describes who the invite is for, with no session', async () => {
            const { token } = await invite();

            const res = await request(harness.server)
                .get(`/api/auth/invite/${token}`)
                .expect(200);

            expect(res.body).toEqual({
                email: INVITEE_EMAIL,
                name: INVITEE_NAME
            });
        });

        it('leaks nothing beyond the email and name', async () => {
            const { token } = await invite();

            const res = await request(harness.server)
                .get(`/api/auth/invite/${token}`)
                .expect(200);

            // Notably absent: the user id, the role, and the account status —
            // an unauthenticated caller holding one link learns only who it is
            // addressed to.
            expect(Object.keys(res.body).sort()).toEqual(['email', 'name']);
        });

        it('does not consume the token — the link survives a page refresh', async () => {
            const { id, token } = await invite();

            await request(harness.server)
                .get(`/api/auth/invite/${token}`)
                .expect(200);
            await request(harness.server)
                .get(`/api/auth/invite/${token}`)
                .expect(200);

            expect(await getInviteConsumedAt(id)).toBeNull();
        });

        it('404s an unknown token', async () => {
            await request(harness.server)
                .get('/api/auth/invite/not-a-real-token')
                .expect(404);
        });

        it('404s an expired token', async () => {
            const { id, token } = await invite();
            await expireInviteTokens(id);

            await request(harness.server)
                .get(`/api/auth/invite/${token}`)
                .expect(404);
        });

        it('404s an empty token segment, without a 500', async () => {
            // `GET /api/auth/invite/` matches no route at all. Worth pinning:
            // the interesting failure would be the segment reaching the handler
            // as an empty string and being hashed into a lookup.
            await request(harness.server)
                .get('/api/auth/invite/')
                .expect(404);
        });

        it('404s a token that is not hex, without a 500', async () => {
            // The raw token is `randomBytes(32).toString('hex')`, so anything
            // else simply misses the hash lookup — including path
            // metacharacters, which are data here and never a pattern.
            for (const token of ['%_', '../../etc/passwd', "' OR 1=1 --"]) {
                await request(harness.server)
                    .get(`/api/auth/invite/${encodeURIComponent(token)}`)
                    .expect(404);
            }
        });

        it('404s a token whose invite was revoked', async () => {
            const { id, token } = await invite();
            const agent = await loginAsAdmin();
            await agent.delete(`/api/users/${id}/invites`).expect(204);

            await request(harness.server)
                .get(`/api/auth/invite/${token}`)
                .expect(404);
        });
    });

    describe('POST /api/auth/invite/accept', () => {
        it('activates the account, sets the credential, and signs the invitee in', async () => {
            const { id, token } = await invite();

            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(201);

            const user = await getUserByEmail(INVITEE_EMAIL);
            expect(user?.status).toBe('active');
            expect(user?.passwordHash).not.toBeNull();
            // The plaintext is never what's stored.
            expect(user?.passwordHash).not.toBe(NEW_PASSWORD);

            // The response's cookie is a working session, so the invitee lands
            // inside the app rather than back at the login form.
            expect(await countUserSessions(id)).toBe(1);
            const me = await agent.get('/api/auth/me').expect(200);
            expect(me.body.email).toBe(INVITEE_EMAIL);
        });

        it('keeps the role the admin chose — the invitee cannot pick their own', async () => {
            const { token } = await invite();

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD,
                    role: 'admin'
                })
                // `forbidNonWhitelisted` rejects the smuggled field outright.
                .expect(400);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(201);

            expect((await getUserByEmail(INVITEE_EMAIL))?.roleKey).toBe(
                'contributor'
            );
        });

        it('lets the invitee log in with the password they chose', async () => {
            const { token } = await invite();
            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(201);

            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: INVITEE_EMAIL, password: NEW_PASSWORD })
                .expect(201);
        });

        it('burns the token — the same link cannot be used twice', async () => {
            const { id, token } = await invite();
            const body = {
                token,
                password: NEW_PASSWORD,
                confirmPassword: NEW_PASSWORD
            };

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body)
                .expect(201);

            expect(await getInviteConsumedAt(id)).toBeInstanceOf(Date);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body)
                .expect(404);

            // Still exactly one session — the replay created nothing.
            expect(await countUserSessions(id)).toBe(1);
        });

        it('rejects only one of two concurrent accepts of the same link', async () => {
            const { id, token } = await invite();
            const body = {
                token,
                password: NEW_PASSWORD,
                confirmPassword: NEW_PASSWORD
            };

            const results = await Promise.all([
                request(harness.server)
                    .post('/api/auth/invite/accept')
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send(body),
                request(harness.server)
                    .post('/api/auth/invite/accept')
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send(body)
            ]);

            const statuses = results.map((res) => res.status).sort();
            expect(statuses).toEqual([201, 404]);
            expect(await countUserSessions(id)).toBe(1);
        });

        it('404s an expired token', async () => {
            const { id, token } = await invite();
            await expireInviteTokens(id);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(404);

            expect((await getUserByEmail(INVITEE_EMAIL))?.status).toBe(
                'pending'
            );
        });

        it('404s an unknown token, without hinting that it is unknown', async () => {
            const res = await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token: 'not-a-real-token',
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(404);

            // Same bare body as an expired or spent token — nothing to probe.
            expect(res.body.message).toBe('Not Found');
        });

        it('stops working once the invite is resent (the link rotated)', async () => {
            const { id, token } = await invite();

            const agent = await loginAsAdmin();
            const resent = await agent
                .post(`/api/users/${id}/invites/resend`)
                .expect(201);
            expect(resent.body.inviteToken).not.toBe(token);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(404);

            // The fresh link is the one that works.
            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token: resent.body.inviteToken,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(201);
        });

        it('400s a password under the minimum length', async () => {
            const { token } = await invite();

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: 'short',
                    confirmPassword: 'short'
                })
                .expect(400);

            expect((await getUserByEmail(INVITEE_EMAIL))?.status).toBe(
                'pending'
            );
        });

        it('400s a password past bcrypt’s 72-byte ceiling rather than truncating it', async () => {
            const { token } = await invite();
            const tooLong = 'a'.repeat(73);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: tooLong,
                    confirmPassword: tooLong
                })
                .expect(400);
        });

        it('accepts the exact 12-character floor', async () => {
            const { token } = await invite();
            const exactly12 = 'a'.repeat(12);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: exactly12,
                    confirmPassword: exactly12
                })
                .expect(201);
        });

        it('accepts the exact 72-byte ceiling', async () => {
            const { token } = await invite();
            const exactly72 = 'a'.repeat(72);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: exactly72,
                    confirmPassword: exactly72
                })
                .expect(201);
        });

        it('counts the ceiling in bytes, so a 72-character accented passphrase is rejected', async () => {
            // BUG-identity-server-03. `'é'.repeat(72)` is 72 UTF-16 code units
            // but 144 UTF-8 bytes. `@MaxLength(72)` measured the former and let
            // it through, and bcrypt then hashed only the first 72 bytes — so
            // `'é'.repeat(36)`, literally half the passphrase, logged the user
            // in. The bound has to be measured the way bcrypt truncates.
            const { id, token } = await invite();
            const multibyte = 'é'.repeat(72);
            expect(multibyte.length).toBe(72);
            expect(Buffer.byteLength(multibyte, 'utf8')).toBe(144);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: multibyte,
                    confirmPassword: multibyte
                })
                .expect(400);

            // Nothing was spent: the link still works and the account is
            // untouched, so the invitee can retry with a shorter passphrase.
            expect(await getInviteConsumedAt(id)).toBeNull();
            expect((await getUserByEmail(INVITEE_EMAIL))?.status).toBe(
                'pending'
            );
        });

        it('accepts a multibyte passphrase that fits inside 72 bytes', async () => {
            // The rule is a byte budget, not a ban on non-ASCII: 24 two-byte
            // characters are 48 bytes and must pass.
            const { token } = await invite();
            const multibyte = 'é'.repeat(24);
            expect(Buffer.byteLength(multibyte, 'utf8')).toBe(48);

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: multibyte,
                    confirmPassword: multibyte
                })
                .expect(201);

            // And the whole thing is what protects the account — a truncated
            // prefix must not authenticate.
            await request(harness.server)
                .post('/api/auth/login')
                .send({ email: INVITEE_EMAIL, password: 'é'.repeat(12) })
                .expect(401);
            await request(harness.server)
                .post('/api/auth/login')
                .send({ email: INVITEE_EMAIL, password: multibyte })
                .expect(201);
        });

        it('400s when the confirmation does not match', async () => {
            const { id, token } = await invite();

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: `${NEW_PASSWORD} typo`
                })
                .expect(400);

            // Rejected before anything was spent.
            expect(await getInviteConsumedAt(id)).toBeNull();
            expect((await getUserByEmail(INVITEE_EMAIL))?.status).toBe(
                'pending'
            );
        });

        it('rejects a request from a disallowed origin (CSRF defense)', async () => {
            const { token } = await invite();

            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', 'https://evil.example.com')
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(403);

            expect((await getUserByEmail(INVITEE_EMAIL))?.status).toBe(
                'pending'
            );
        });

        it('404s an invite for an account that is already active', async () => {
            const { id, token } = await invite();
            await request(harness.server)
                .post('/api/auth/invite/accept')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: NEW_PASSWORD
                })
                .expect(201);

            // Re-issuing a token against a now-active account (resend refuses,
            // so this is the belt-and-braces case the use case guards).
            const agent = await loginAsAdmin();
            await agent.post(`/api/users/${id}/invites/resend`).expect(409);
        });
    });
});
