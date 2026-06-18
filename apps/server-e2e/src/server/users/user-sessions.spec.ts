import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countUserSessions,
    resetDb,
    seedActiveUser,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'sessions-admin@example.com';
const TARGET_EMAIL = 'sessions-target@example.com';
const PASSWORD = 'SecurePass123!';

/** `GET/DELETE /api/users/:id/sessions` — admin session management. */
describe('User sessions (admin)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let target: SeededUser;

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
        target = await seedActiveUser(harness.app, {
            email: TARGET_EMAIL,
            password: PASSWORD,
            role: 'viewer'
        });
    });

    /** Logs in and returns the cookie-bearing agent (each login opens a session). */
    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('rejects unauthenticated access with 401', async () => {
        await request(harness.server)
            .get(`/api/users/${target.id}/sessions`)
            .expect(401);
    });

    it('lists a member’s live sessions', async () => {
        await login(TARGET_EMAIL); // opens one session for the target
        const adminAgent = await login(ADMIN_EMAIL);

        const res = await adminAgent
            .get(`/api/users/${target.id}/sessions`)
            .expect(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({ current: false });
        expect(res.body[0].id).toEqual(expect.any(String));
    });

    it('marks the caller’s own session as current', async () => {
        const adminAgent = await login(ADMIN_EMAIL);
        const res = await adminAgent
            .get(`/api/users/${admin.id}/sessions`)
            .expect(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].current).toBe(true);
    });

    it('revokes a session and drops it from the list', async () => {
        await login(TARGET_EMAIL);
        const adminAgent = await login(ADMIN_EMAIL);

        const list = await adminAgent
            .get(`/api/users/${target.id}/sessions`)
            .expect(200);
        const sessionId = list.body[0].id as string;

        await adminAgent
            .delete(`/api/users/${target.id}/sessions/${sessionId}`)
            .expect(204);

        const after = await adminAgent
            .get(`/api/users/${target.id}/sessions`)
            .expect(200);
        expect(after.body).toHaveLength(0);
        // Revocation is soft (sets `revokedAt`), so the row is kept for audit —
        // it just drops out of the live listing above.
        expect(await countUserSessions(target.id)).toBe(1);
    });

    it('is idempotent — revoking an unknown session still 204s', async () => {
        const adminAgent = await login(ADMIN_EMAIL);
        await adminAgent
            .delete(`/api/users/${target.id}/sessions/does-not-exist`)
            .expect(204);
    });

    it('lets a viewer read sessions but not revoke them (403)', async () => {
        await login(TARGET_EMAIL);
        const adminAgent = await login(ADMIN_EMAIL);
        const list = await adminAgent
            .get(`/api/users/${target.id}/sessions`)
            .expect(200);
        const sessionId = list.body[0].id as string;

        const viewerAgent = await login(TARGET_EMAIL); // viewer role
        await viewerAgent
            .get(`/api/users/${target.id}/sessions`)
            .expect(200);
        await viewerAgent
            .delete(`/api/users/${target.id}/sessions/${sessionId}`)
            .expect(403);
    });

    it('returns 400 for a non-uuid user id', async () => {
        const adminAgent = await login(ADMIN_EMAIL);
        await adminAgent.get('/api/users/not-a-uuid/sessions').expect(400);
    });
});
