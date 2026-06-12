import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countUserSessions,
    getUserByEmail,
    resetDb,
    seedActiveUser,
    seedUser,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'status-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** `POST /api/users/:id/disable` and `/enable` — flip account status. */
describe('POST /api/users/:id/(disable|enable)', () => {
    let harness: TestApp;
    let admin: SeededUser;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
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

    it('disables an active member and revokes their sessions', async () => {
        // A logged-in member with a live session, then disabled by the admin.
        const member = await seedActiveUser(harness.app, {
            email: 'member@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        await login('member@example.com'); // opens a session
        expect(await countUserSessions(member.id)).toBe(1);

        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post(`/api/users/${member.id}/disable`)
            .expect(201);
        expect(res.body.status).toBe('disabled');

        const row = await getUserByEmail('member@example.com');
        expect(row?.status).toBe('disabled');

        // The disabled member can no longer authenticate with the old session.
        await request(harness.server)
            .post('/api/auth/login')
            .send({ email: 'member@example.com', password: PASSWORD })
            .expect(401);
    });

    it('refuses to let a member disable themselves with 409', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${admin.id}/disable`).expect(409);

        const row = await getUserByEmail(ADMIN_EMAIL);
        expect(row?.status).toBe('active');
    });

    it('rejects disabling an already-disabled member with 409', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'disabled'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${member.id}/disable`).expect(409);
    });

    it('re-enables a disabled member', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'disabled'
        });
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post(`/api/users/${member.id}/enable`)
            .expect(201);
        expect(res.body.status).toBe('active');

        const row = await getUserByEmail('member@example.com');
        expect(row?.status).toBe('active');
    });

    it('rejects enabling an already-active member with 409', async () => {
        const member = await seedActiveUser(harness.app, {
            email: 'member@example.com',
            password: PASSWORD,
            role: 'viewer'
        });
        const agent = await login(ADMIN_EMAIL);
        await agent.post(`/api/users/${member.id}/enable`).expect(409);
    });

    it('returns 404 disabling an unknown id', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/users/00000000-0000-0000-0000-000000000000/disable')
            .expect(404);
    });

    it('rejects an unauthenticated request with 401', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'active'
        });
        await request(harness.server)
            .post(`/api/users/${member.id}/disable`)
            .expect(401);
    });

    it('forbids a contributor (lacks users:update) with 403', async () => {
        const member = await seedUser(harness.app, {
            email: 'member@example.com',
            role: 'viewer',
            status: 'active'
        });
        await seedActiveUser(harness.app, {
            email: 'contributor@example.com',
            password: PASSWORD,
            role: 'contributor'
        });
        const agent = await login('contributor@example.com');
        await agent.post(`/api/users/${member.id}/disable`).expect(403);
    });
});
