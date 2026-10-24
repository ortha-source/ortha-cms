import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countUsers,
    getInviteTokenHashes,
    getUserByEmail,
    getWorkspaceIdsForUser,
    resetDb,
    seedActiveUser,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'batch-admin@example.com';
const CONTRIBUTOR_EMAIL = 'batch-contributor@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The members redesign's server surface: `POST /api/users/invites/batch`,
 * `GET /api/users/roles` and `GET /api/users/:id/sign-in`.
 */
describe('Members redesign routes', () => {
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
            role: 'admin',
            name: 'Ada Admin'
        });
        await seedActiveUser(harness.app, {
            email: CONTRIBUTOR_EMAIL,
            password: PASSWORD,
            role: 'contributor'
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

    describe('POST /api/users/invites/batch', () => {
        it('invites every address with one role and one set of workspaces', async () => {
            const workspace = await seedWorkspace({
                name: 'Marketing site',
                slug: 'marketing-site'
            });
            const agent = await login(ADMIN_EMAIL);

            const res = await agent
                .post('/api/users/invites/batch')
                .send({
                    emails: ['Lena@Growth.io', 'sam@growth.io'],
                    role: 'contributor',
                    workspaceIds: [workspace.id]
                })
                .expect(201);

            expect(res.body.items).toHaveLength(2);
            expect(res.body.items[0]).toMatchObject({
                email: 'lena@growth.io',
                status: 'pending',
                role: { key: 'contributor' },
                inviteToken: expect.any(String),
                inviteExpiresAt: expect.any(String)
            });
            for (const email of ['lena@growth.io', 'sam@growth.io']) {
                const row = await getUserByEmail(email);
                expect(row?.status).toBe('pending');
                expect(await getInviteTokenHashes(row?.id ?? '')).toHaveLength(
                    1
                );
                expect(await getWorkspaceIdsForUser(row?.id ?? '')).toEqual([
                    workspace.id
                ]);
            }
        });

        it('refuses the whole batch with a 409 naming every taken address', async () => {
            const agent = await login(ADMIN_EMAIL);
            const before = await countUsers();

            const res = await agent
                .post('/api/users/invites/batch')
                .send({
                    emails: ['new@growth.io', CONTRIBUTOR_EMAIL.toUpperCase()],
                    role: 'viewer'
                })
                .expect(409);

            expect(res.body).toMatchObject({
                code: 'EMAIL_TAKEN',
                emails: [CONTRIBUTOR_EMAIL]
            });
            // All-or-nothing: the free address was not invited either.
            expect(await countUsers()).toBe(before);
            expect(await getUserByEmail('new@growth.io')).toBeNull();
        });

        it('400s a duplicated address, however it is cased', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/users/invites/batch')
                .send({ emails: ['a@x.io', 'A@X.io'], role: 'viewer' })
                .expect(400);
        });

        it('403s a caller without users:create', async () => {
            const agent = await login(CONTRIBUTOR_EMAIL);
            await agent
                .post('/api/users/invites/batch')
                .send({ emails: ['new@growth.io'], role: 'viewer' })
                .expect(403);
        });
    });

    describe('GET /api/users/roles', () => {
        it('answers the three assignable roles with their grants', async () => {
            const agent = await login(CONTRIBUTOR_EMAIL);
            const res = await agent.get('/api/users/roles').expect(200);

            expect(
                res.body.items.map((role: { key: string }) => role.key)
            ).toEqual(['admin', 'contributor', 'viewer']);
            const admin = res.body.items[0];
            expect(admin.permissions).toContain('users:update');
        });
    });

    describe('GET /api/users/:id/sign-in', () => {
        it('reports a password and no SSO for a password account', async () => {
            const agent = await login(ADMIN_EMAIL);
            const contributor = await getUserByEmail(CONTRIBUTOR_EMAIL);

            const res = await agent
                .get(`/api/users/${contributor?.id}/sign-in`)
                .expect(200);
            expect(res.body).toEqual({ hasPassword: true, ssoProviders: [] });
        });

        it('403s a caller without users:update', async () => {
            const agent = await login(CONTRIBUTOR_EMAIL);
            const admin = await getUserByEmail(ADMIN_EMAIL);
            await agent.get(`/api/users/${admin?.id}/sign-in`).expect(403);
        });
    });

    describe('GET /api/users', () => {
        it('carries directory-wide counts and narrows by role', async () => {
            const agent = await login(ADMIN_EMAIL);

            const all = await agent.get('/api/users').expect(200);
            expect(all.body.counts).toMatchObject({
                everyone: 2,
                active: 2,
                admins: 1,
                invited: 0,
                disabled: 0
            });

            const admins = await agent.get('/api/users?role=admin').expect(200);
            expect(admins.body.total).toBe(1);
            expect(admins.body.items[0].email).toBe(ADMIN_EMAIL);
            // The counts describe the directory, not the filtered page.
            expect(admins.body.counts.everyone).toBe(2);
            // Signing in is what "last active" reports.
            expect(admins.body.items[0].lastActiveAt).toEqual(
                expect.any(String)
            );
        });
    });
});
