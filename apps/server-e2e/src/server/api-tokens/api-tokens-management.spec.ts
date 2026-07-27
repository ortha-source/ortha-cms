import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedUserWithEmptyRole,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'token-admin@example.com';
const NORIGHTS_EMAIL = 'token-norights@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * `/api/api-tokens` — the SESSION-authenticated management API for external-API
 * bearer tokens. Covers minting (plaintext returned once), listing (never the
 * secret), revoking, and the `tokens:*` permission gate.
 */
describe('API token management (/api/api-tokens)', () => {
    let harness: TestApp;
    let workspaceId: string;

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
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
    });

    /** Logs in and returns a cookie-bearing agent. */
    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return agent;
    }

    it('mints a token and returns the plaintext exactly once', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/api-tokens')
            .send({ name: 'CI', workspaceId, scope: 'read' })
            .expect(201);

        expect(res.body.secret).toEqual(expect.any(String));
        expect(res.body.secret.startsWith('orthacms_')).toBe(true);
        expect(res.body.scope).toBe('read');
        expect(res.body.workspaceId).toBe(workspaceId);

        // The list never carries the secret — only the display prefix.
        const list = await agent.get('/api/api-tokens').expect(200);
        expect(list.body.total).toBe(1);
        const [item] = list.body.items;
        expect(item).not.toHaveProperty('secret');
        expect(item).not.toHaveProperty('tokenHash');
        expect(item.lookupPrefix).toEqual(expect.any(String));
    });

    it('rejects an expiry in the past', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({
                name: 'stale',
                workspaceId,
                scope: 'read',
                expiresAt: new Date(Date.now() - 60_000).toISOString()
            })
            .expect(400);
    });

    it('revokes a token', async () => {
        const agent = await login(ADMIN_EMAIL);
        const created = await agent
            .post('/api/api-tokens')
            .send({ name: 'temp', workspaceId, scope: 'full' })
            .expect(201);

        await agent.delete(`/api/api-tokens/${created.body.id}`).expect(204);

        const list = await agent.get('/api/api-tokens').expect(200);
        const [item] = list.body.items;
        expect(item.revokedAt).not.toBeNull();
        expect(item.status).toBe('revoked');
    });

    it('gates management on the tokens permissions', async () => {
        await seedUserWithEmptyRole(harness.app, {
            email: NORIGHTS_EMAIL,
            password: PASSWORD,
            roleKey: 'token-mgmt-norights'
        });
        const agent = await login(NORIGHTS_EMAIL);

        await agent.get('/api/api-tokens').expect(403);
        await agent
            .post('/api/api-tokens')
            .send({ name: 'nope', workspaceId, scope: 'read' })
            .expect(403);
    });

    it('requires authentication', async () => {
        await request(harness.server).get('/api/api-tokens').expect(401);
    });
});
