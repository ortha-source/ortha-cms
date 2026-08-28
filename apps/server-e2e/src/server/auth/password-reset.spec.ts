import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';
import {
    ageResetTokens,
    countUserSessions,
    expireResetTokens,
    getActivityRows,
    getResetConsumedAt,
    getResetTokenHashes,
    getUserByEmail,
    resetDb,
    seedActiveUser,
    seedUser,
    setUserStatus,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'reset-admin@example.com';
const ADMIN_PASSWORD = 'SecurePass123!';
const MEMBER_EMAIL = 'reset-member@example.com';
const MEMBER_PASSWORD = 'MemberPass123!';
/** Comfortably over the server's 12-character minimum. */
const NEW_PASSWORD = 'correct horse battery staple';

/**
 * The admin-driven password reset, end to end across two plugins:
 * `POST /api/users/:id/password-reset` (users — mint a link) and
 * `GET /api/auth/reset/:token` + `POST /api/auth/reset` (identity — describe
 * and redeem it).
 *
 * The invariants worth pinning are the ones a reset gets wrong quietly: the
 * link is one-time, it reveals nothing about accounts it is not for, it cannot
 * be minted for an account that has no password or is locked out, and redeeming
 * it evicts **every** session the old password had opened.
 */
describe('reset a password', () => {
    let harness: TestApp;
    let member: SeededUser;

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
        member = await seedActiveUser(harness.app, {
            email: MEMBER_EMAIL,
            password: MEMBER_PASSWORD,
            role: 'contributor'
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

    /** Open a session for the member, so evictions have something to evict. */
    async function loginAsMember() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD })
            .expect(201);
        return agent;
    }

    /** Mint a reset link for the standard member and return the raw token. */
    async function issueReset(userId = member.id): Promise<string> {
        const agent = await loginAsAdmin();
        const res = await agent
            .post(`/api/users/${userId}/password-reset`)
            .expect(201);
        return res.body.resetToken as string;
    }

    describe('POST /api/users/:id/password-reset', () => {
        it('mints exactly one token and hands the raw value back once', async () => {
            const token = await issueReset();

            expect(typeof token).toBe('string');
            expect(token).not.toHaveLength(0);
            expect(await getResetTokenHashes(member.id)).toHaveLength(1);

            // The list/detail reads must never carry it — only the mint does.
            const agent = await loginAsAdmin();
            const detail = await agent
                .get(`/api/users/${member.id}`)
                .expect(200);
            expect(detail.body.resetToken).toBeUndefined();

            const list = await agent.get('/api/users').expect(200);
            for (const row of list.body.items) {
                expect(row.resetToken).toBeUndefined();
            }
        });

        it('stores only the hash — the raw token is not in the database', async () => {
            const token = await issueReset();
            const [hash] = await getResetTokenHashes(member.id);
            expect(hash).not.toBe(token);
        });

        it('rotates: issuing again kills the previous link', async () => {
            const first = await issueReset();
            await ageResetTokens(member.id);
            const second = await issueReset();

            expect(second).not.toBe(first);
            // Exactly one live token, so the old link cannot still be redeemed.
            expect(await getResetTokenHashes(member.id)).toHaveLength(1);
            await request(harness.server)
                .get(`/api/auth/reset/${first}`)
                .expect(404);
            await request(harness.server)
                .get(`/api/auth/reset/${second}`)
                .expect(200);
        });

        it('refuses a second issue inside the cooldown, so a double-click cannot orphan the first link', async () => {
            const first = await issueReset();
            const agent = await loginAsAdmin();

            const res = await agent
                .post(`/api/users/${member.id}/password-reset`)
                .expect(409);
            expect(res.body.code).toBe('PASSWORD_RESET_RECENTLY_SENT');
            expect(res.body.retryAfterSeconds).toBeGreaterThan(0);

            // The point of the refusal: the link the admin is holding still works.
            await request(harness.server)
                .get(`/api/auth/reset/${first}`)
                .expect(200);
        });

        it('409s a pending member — there is no password to reset yet', async () => {
            const pending = await seedUser(harness.app, {
                email: 'reset-pending@example.com',
                role: 'viewer',
                status: 'pending'
            });
            const agent = await loginAsAdmin();

            const res = await agent
                .post(`/api/users/${pending.id}/password-reset`)
                .expect(409);
            expect(res.body.code).toBe('INVALID_MEMBER_STATE');
            expect(await getResetTokenHashes(pending.id)).toHaveLength(0);
        });

        it('409s a suspended member — a reset must not reopen a closed account', async () => {
            await setUserStatus(member.id, 'disabled');
            const agent = await loginAsAdmin();

            await agent
                .post(`/api/users/${member.id}/password-reset`)
                .expect(409);
            expect(await getResetTokenHashes(member.id)).toHaveLength(0);
        });

        it('404s an unknown member', async () => {
            const agent = await loginAsAdmin();
            await agent
                .post(
                    '/api/users/11111111-1111-4111-8111-111111111111/password-reset'
                )
                .expect(404);
        });

        it('403s a caller without users:update', async () => {
            const contributor = request.agent(harness.server);
            await contributor
                .post('/api/auth/login')
                .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD })
                .expect(201);

            await contributor
                .post(`/api/users/${member.id}/password-reset`)
                .expect(403);
            expect(await getResetTokenHashes(member.id)).toHaveLength(0);
        });

        it('401s an unauthenticated caller', async () => {
            await request(harness.server)
                .post(`/api/users/${member.id}/password-reset`)
                .expect(401);
        });

        it('audits the issue against the admin who performed it', async () => {
            await issueReset();

            const rows = await getActivityRows();
            const issued = rows.find(
                (row) => row.kind === 'user.password_reset_issued'
            );
            expect(issued).toBeDefined();
            expect(issued?.subjectId).toBe(member.id);
            expect(issued?.actorEmail).toBe(ADMIN_EMAIL);
        });
    });

    describe('GET /api/auth/reset/:token', () => {
        it('names the account the link is for, with no session', async () => {
            const token = await issueReset();

            const res = await request(harness.server)
                .get(`/api/auth/reset/${token}`)
                .expect(200);

            expect(res.body).toEqual({
                email: MEMBER_EMAIL,
                name: null
            });
        });

        it('leaks nothing beyond the email and name', async () => {
            const token = await issueReset();

            const res = await request(harness.server)
                .get(`/api/auth/reset/${token}`)
                .expect(200);

            // Notably absent: the user id, the role, and the account status —
            // an unauthenticated caller holding one link learns only whose
            // account it opens.
            expect(Object.keys(res.body).sort()).toEqual(['email', 'name']);
        });

        it('does not consume the token — the link survives a page refresh', async () => {
            const token = await issueReset();

            await request(harness.server)
                .get(`/api/auth/reset/${token}`)
                .expect(200);
            await request(harness.server)
                .get(`/api/auth/reset/${token}`)
                .expect(200);

            expect(await getResetConsumedAt(member.id)).toBeNull();
        });

        it('404s an unknown token', async () => {
            await request(harness.server)
                .get('/api/auth/reset/not-a-real-token')
                .expect(404);
        });

        it('404s an expired token', async () => {
            const token = await issueReset();
            await expireResetTokens(member.id);

            await request(harness.server)
                .get(`/api/auth/reset/${token}`)
                .expect(404);
        });

        it('404s an empty token segment, without a 500', async () => {
            await request(harness.server).get('/api/auth/reset/').expect(404);
        });

        it('404s a token that is not hex, without a 500', async () => {
            for (const token of ['%_', '../../etc/passwd', "' OR 1=1 --"]) {
                await request(harness.server)
                    .get(`/api/auth/reset/${encodeURIComponent(token)}`)
                    .expect(404);
            }
        });

        it('does not honour an invite token — the two flows never cross', async () => {
            // A reset skips the pending → active transition entirely, so an
            // invite token resolving here would set a credential on an account
            // that was never activated.
            const admin = await loginAsAdmin();
            const invited = await admin
                .post('/api/users/invites')
                .send({ email: 'crossover@example.com', role: 'viewer' })
                .expect(201);

            await request(harness.server)
                .get(`/api/auth/reset/${invited.body.inviteToken}`)
                .expect(404);
        });
    });

    describe('POST /api/auth/reset', () => {
        const body = (token: string) => ({
            token,
            password: NEW_PASSWORD,
            confirmPassword: NEW_PASSWORD
        });

        it('sets the new credential and lets the member sign in with it', async () => {
            const token = await issueReset();
            const before = await getUserByEmail(MEMBER_EMAIL);

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(201);

            const after = await getUserByEmail(MEMBER_EMAIL);
            expect(after?.passwordHash).not.toBe(before?.passwordHash);
            // The plaintext is never what's stored.
            expect(after?.passwordHash).not.toBe(NEW_PASSWORD);
            expect(after?.status).toBe('active');

            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: NEW_PASSWORD })
                .expect(201);
        });

        it('kills the old password', async () => {
            const token = await issueReset();
            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(201);

            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD })
                .expect(401);
        });

        it('revokes every live session — the old password does not outlive itself', async () => {
            const live = await loginAsMember();
            await loginAsMember();
            expect(await countUserSessions(member.id)).toBe(2);
            await live.get('/api/auth/me').expect(200);

            const token = await issueReset();
            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(201);

            // Whoever held a session opened by the old password is out.
            await live.get('/api/auth/me').expect(401);
        });

        it('issues no session of its own — holding a link is not signing in', async () => {
            const token = await issueReset();
            const agent = request.agent(harness.server);

            await agent
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(201);

            await agent.get('/api/auth/me').expect(401);
        });

        it('burns the token — the same link cannot be used twice', async () => {
            const token = await issueReset();

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(201);
            expect(await getResetConsumedAt(member.id)).not.toBeNull();

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: 'a different passphrase entirely',
                    confirmPassword: 'a different passphrase entirely'
                })
                .expect(404);

            // The first redemption is the one that stands.
            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: NEW_PASSWORD })
                .expect(201);
        });

        it('lets only one of two concurrent redemptions of the same link through', async () => {
            // The pre-check outside the transaction is advisory: both requests
            // read a live token, both hash a password, and then the conditional
            // `consume` decides. If that write were a read-then-update the
            // second would also succeed — and would overwrite the credential
            // the first person had just chosen, with no way for either to know
            // which one is now on the account.
            const live = await loginAsMember();
            await loginAsMember();
            expect(await countUserSessions(member.id)).toBe(2);

            const token = await issueReset();
            const second = 'entirely different passphrase';

            const results = await Promise.all([
                request(harness.server)
                    .post('/api/auth/reset')
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send(body(token)),
                request(harness.server)
                    .post('/api/auth/reset')
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({
                        token,
                        password: second,
                        confirmPassword: second
                    })
            ]);

            expect(results.map((res) => res.status).sort()).toEqual([201, 404]);
            expect(await getResetConsumedAt(member.id)).toBeInstanceOf(Date);

            // Exactly one credential is on the account, and it is the winner's.
            // Which one won is a race; that only one of them did is not.
            const winner = results[0].status === 201 ? NEW_PASSWORD : second;
            const loser = winner === NEW_PASSWORD ? second : NEW_PASSWORD;
            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: loser })
                .expect(401);
            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: winner })
                .expect(201);

            // The eviction happened once, not twice: the losing request threw
            // before it reached the session repository, so the two pre-existing
            // sessions are gone and nothing double-counted them.
            await live.get('/api/auth/me').expect(401);
            const changed = (await getActivityRows()).filter(
                (row) => row.kind === 'user.password_changed'
            );
            expect(changed).toHaveLength(1);
            expect(changed[0].meta).toMatchObject({ sessionsRevoked: 2 });
        });

        it('400s a password past bcrypt’s 72-byte ceiling rather than truncating it', async () => {
            const token = await issueReset();
            const tooLong = 'a'.repeat(73);

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: tooLong,
                    confirmPassword: tooLong
                })
                .expect(400);

            expect(await getResetConsumedAt(member.id)).toBeNull();
        });

        it('counts the ceiling in bytes, so a 72-character accented passphrase is rejected', async () => {
            // The reset path has its own DTO, so the byte-counted bound has to
            // be asserted here too: `'é'.repeat(72)` is 72 UTF-16 code units
            // and 144 UTF-8 bytes, and a character-counted `@MaxLength(72)`
            // would wave it through for bcrypt to silently halve.
            const token = await issueReset();
            const multibyte = 'é'.repeat(72);
            expect(multibyte.length).toBe(72);
            expect(Buffer.byteLength(multibyte, 'utf8')).toBe(144);

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: multibyte,
                    confirmPassword: multibyte
                })
                .expect(400);

            // Nothing spent, nothing changed — the link is still good.
            expect(await getResetConsumedAt(member.id)).toBeNull();
            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD })
                .expect(201);
        });

        it('accepts the exact 72-byte ceiling, and a multibyte passphrase inside it', async () => {
            // The rule is a byte budget, not a ban on non-ASCII — and the whole
            // passphrase is what protects the account, not a truncated prefix.
            const token = await issueReset();
            const multibyte = 'é'.repeat(36);
            expect(Buffer.byteLength(multibyte, 'utf8')).toBe(72);

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: multibyte,
                    confirmPassword: multibyte
                })
                .expect(201);

            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: 'é'.repeat(18) })
                .expect(401);
            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: multibyte })
                .expect(201);
        });

        it('404s an expired token, leaving the old password in place', async () => {
            const token = await issueReset();
            await expireResetTokens(member.id);

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(404);

            await request(harness.server)
                .post('/api/auth/login')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD })
                .expect(201);
        });

        it('404s once the account has been suspended, even with a live link', async () => {
            const token = await issueReset();
            await setUserStatus(member.id, 'disabled');

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(404);
        });

        it('rejects a password that misses the server rules', async () => {
            const token = await issueReset();

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ token, password: 'short', confirmPassword: 'short' })
                .expect(400);

            // A rejected password must not spend the link.
            expect(await getResetConsumedAt(member.id)).toBeNull();
        });

        it('rejects a mismatched confirmation server-side', async () => {
            const token = await issueReset();

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({
                    token,
                    password: NEW_PASSWORD,
                    confirmPassword: `${NEW_PASSWORD}!`
                })
                .expect(400);
        });

        it('cannot be pointed at another account', async () => {
            const token = await issueReset();

            // `forbidNonWhitelisted` rejects the smuggled field outright, so
            // which account is reset stays a property of the token alone.
            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ ...body(token), email: ADMIN_EMAIL })
                .expect(400);
        });

        it('rejects a hostile Origin', async () => {
            const token = await issueReset();

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', 'https://evil.example')
                .send(body(token))
                .expect(403);

            expect(await getResetConsumedAt(member.id)).toBeNull();
        });

        it('audits the change against the member, with the eviction count', async () => {
            await loginAsMember();
            const token = await issueReset();

            await request(harness.server)
                .post('/api/auth/reset')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send(body(token))
                .expect(201);

            const rows = await getActivityRows();
            const changed = rows.find(
                (row) => row.kind === 'user.password_changed'
            );
            expect(changed).toBeDefined();
            expect(changed?.subjectId).toBe(member.id);
            // The member chose the password, so they are the actor — the admin
            // only handed over a link, which is its own audit row.
            expect(changed?.actorEmail).toBe(MEMBER_EMAIL);
            expect(changed?.meta).toMatchObject({ sessionsRevoked: 1 });
        });
    });
});
