import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
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
});
