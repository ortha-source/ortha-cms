import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    ageInviteTokens,
    getInviteTokenHashes,
    getUserByEmail,
    resetDb,
    seedActiveUser,
    seedUser
} from '../../support/seed';

const ADMIN_EMAIL = 'invites-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `POST /api/users/:id/invites/resend` and `DELETE /api/users/:id/invites`. */
describe('manage pending invites', () => {
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
            password: PASSWORD,
            role: 'admin'
        });
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Invite a pending member and return their id. */
    async function invite(email: string): Promise<string> {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/users/invites')
            .send({ email, role: 'viewer' })
            .expect(201);
        return res.body.id as string;
    }

    describe('POST /api/users/:id/invites/resend', () => {
        it('rotates the invite token, keeping exactly one live', async () => {
            const id = await invite('pending@example.com');
            const before = await getInviteTokenHashes(id);
            expect(before).toHaveLength(1);
            // Step past the resend cooldown — this spec is about rotation, not
            // about the window (which has its own cases below).
            await ageInviteTokens(id);

            const agent = await login(ADMIN_EMAIL);
            await agent.post(`/api/users/${id}/invites/resend`).expect(201);

            const after = await getInviteTokenHashes(id);
            expect(after).toHaveLength(1);
            // A fresh token: the previous link no longer matches.
            expect(after[0]).not.toBe(before[0]);
        });

        it('rejects resending to an active member with 409', async () => {
            const member = await seedActiveUser(harness.app, {
                email: 'active@example.com',
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post(`/api/users/${member.id}/invites/resend`)
                .expect(409);
        });

        it('returns 404 for an unknown id', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post(
                    '/api/users/00000000-0000-0000-0000-000000000000/invites/resend'
                )
                .expect(404);
        });

        it('forbids a contributor (lacks users:create) with 403', async () => {
            const id = await invite('pending@example.com');
            await seedActiveUser(harness.app, {
                email: 'contributor@example.com',
                password: PASSWORD,
                role: 'contributor'
            });
            const agent = await login('contributor@example.com');
            await agent.post(`/api/users/${id}/invites/resend`).expect(403);
        });
    });

    describe('DELETE /api/users/:id/invites', () => {
        it('revokes a pending invite, deleting the placeholder user (204)', async () => {
            const id = await invite('pending@example.com');
            const agent = await login(ADMIN_EMAIL);
            await agent.delete(`/api/users/${id}/invites`).expect(204);

            expect(await getUserByEmail('pending@example.com')).toBeNull();
        });

        it('refuses to revoke an active member with 409', async () => {
            const member = await seedActiveUser(harness.app, {
                email: 'active@example.com',
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = await login(ADMIN_EMAIL);
            await agent.delete(`/api/users/${member.id}/invites`).expect(409);

            // The real account is untouched.
            expect(await getUserByEmail('active@example.com')).not.toBeNull();
        });

        it('returns 404 for an unknown id', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .delete(
                    '/api/users/00000000-0000-0000-0000-000000000000/invites'
                )
                .expect(404);
        });

        it('forbids a contributor (lacks users:delete) with 403', async () => {
            const id = await invite('pending@example.com');
            await seedActiveUser(harness.app, {
                email: 'contributor@example.com',
                password: PASSWORD,
                role: 'contributor'
            });
            const agent = await login('contributor@example.com');
            await agent.delete(`/api/users/${id}/invites`).expect(403);
        });
    });

    describe('resend cooldown (INVITE_RECENTLY_SENT)', () => {
        // Rotation is destructive and the raw token is unrecoverable — only its
        // hash is stored — so the server cannot hand back the link it just
        // minted. Refusing the second call is the only way a double-clicked
        // Resend doesn't leave the admin holding a dead token.
        it('refuses a resend issued moments ago, with a machine code', async () => {
            const id = await invite('cooldown@example.com');
            const before = await getInviteTokenHashes(id);

            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .post(`/api/users/${id}/invites/resend`)
                .expect(409);

            expect(res.body.code).toBe('INVITE_RECENTLY_SENT');
            expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
            // The crucial part: the link the admin already holds still works.
            expect(await getInviteTokenHashes(id)).toEqual(before);
        });

        it('allows the resend once the window has passed', async () => {
            const id = await invite('cooldown-ok@example.com');
            const before = await getInviteTokenHashes(id);
            await ageInviteTokens(id);

            const agent = await login(ADMIN_EMAIL);
            await agent.post(`/api/users/${id}/invites/resend`).expect(201);

            const after = await getInviteTokenHashes(id);
            expect(after).toHaveLength(1);
            expect(after[0]).not.toBe(before[0]);
        });

        it('does not apply to the first invite', async () => {
            // A brand-new invite has nothing to protect; only resend is gated.
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/users/invites')
                .send({ email: 'first-invite@example.com', role: 'viewer' })
                .expect(201);
        });

        it('keeps one live token when two resends race', async () => {
            const id = await invite('race@example.com');
            await ageInviteTokens(id);

            const agent = await login(ADMIN_EMAIL);
            const [a, b] = await Promise.all([
                agent.post(`/api/users/${id}/invites/resend`),
                agent.post(`/api/users/${id}/invites/resend`)
            ]);

            // Whichever loses is refused rather than silently destroying the
            // winner's link; either way exactly one token survives.
            expect([a.status, b.status].sort()).toEqual([201, 409]);
            expect(await getInviteTokenHashes(id)).toHaveLength(1);
        });
    });

    describe('conflict bodies carry a stable machine code', () => {
        // The domain distinguishes these precisely; flattening them all to a
        // 409 with only an English sentence left clients string-matching prose,
        // so the actionable reason never reached the user (WCAG 3.3.1 / 3.3.3).
        it('tags a resend to an active member as INVALID_MEMBER_STATE', async () => {
            const member = await seedActiveUser(harness.app, {
                email: 'already-active@example.com',
                password: PASSWORD,
                role: 'viewer'
            });
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .post(`/api/users/${member.id}/invites/resend`)
                .expect(409);

            expect(res.body.code).toBe('INVALID_MEMBER_STATE');
            // Additive, not a replacement: the old fields are still there.
            expect(res.body.statusCode).toBe(409);
            expect(res.body.error).toBe('Conflict');
            expect(typeof res.body.message).toBe('string');
        });

        it('tags a duplicate invite as EMAIL_TAKEN', async () => {
            await invite('dupe@example.com');
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .post('/api/users/invites')
                .send({ email: 'dupe@example.com', role: 'viewer' })
                .expect(409);

            expect(res.body.code).toBe('EMAIL_TAKEN');
        });
    });
});
