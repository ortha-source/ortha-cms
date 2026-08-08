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
 * bearer tokens. Covers minting (plaintext returned once), the multi-workspace
 * bucket, listing (never the secret), revoking, and the `tokens:*` permission
 * gate.
 */
describe('API token management (/api/api-tokens)', () => {
    let harness: TestApp;
    let workspaceId: string;
    let otherWorkspaceId: string;

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
        otherWorkspaceId = (await seedWorkspace({ name: 'WS B', slug: 'ws-b' }))
            .id;
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
            .send({ name: 'CI', workspaceIds: [workspaceId], scope: 'read' })
            .expect(201);

        expect(res.body.secret).toEqual(expect.any(String));
        expect(res.body.secret.startsWith('orthacms_')).toBe(true);
        expect(res.body.scope).toBe('read');
        expect(res.body.workspaceIds).toEqual([workspaceId]);

        // The list never carries the secret — only the display prefix.
        const list = await agent.get('/api/api-tokens').expect(200);
        expect(list.body.total).toBe(1);
        const [item] = list.body.items;
        expect(item).not.toHaveProperty('secret');
        expect(item).not.toHaveProperty('tokenHash');
        expect(item.lookupPrefix).toEqual(expect.any(String));
    });

    it('mints a token spanning several workspaces', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'multi',
                workspaceIds: [workspaceId, otherWorkspaceId],
                scope: 'read'
            })
            .expect(201);

        expect(res.body.workspaceIds.sort()).toEqual(
            [workspaceId, otherWorkspaceId].sort()
        );

        const list = await agent.get('/api/api-tokens').expect(200);
        expect(list.body.items[0].workspaceIds.sort()).toEqual(
            [workspaceId, otherWorkspaceId].sort()
        );
    });

    it('collapses duplicate workspace ids', async () => {
        const agent = await login(ADMIN_EMAIL);
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'dupes',
                workspaceIds: [workspaceId, workspaceId],
                scope: 'read'
            })
            .expect(201);

        expect(res.body.workspaceIds).toEqual([workspaceId]);
    });

    it('rejects an empty workspace bucket', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({ name: 'nowhere', workspaceIds: [], scope: 'read' })
            .expect(400);
    });

    it('lists a multi-workspace token under each of its workspaces', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({
                name: 'multi',
                workspaceIds: [workspaceId, otherWorkspaceId],
                scope: 'read'
            })
            .expect(201);
        await agent
            .post('/api/api-tokens')
            .send({ name: 'solo', workspaceIds: [workspaceId], scope: 'read' })
            .expect(201);

        // Filtering by a workspace is a bucket-membership test — the
        // multi-workspace token appears under both, exactly once each.
        const first = await agent
            .get('/api/api-tokens')
            .query({ workspaceId })
            .expect(200);
        expect(first.body.total).toBe(2);

        const second = await agent
            .get('/api/api-tokens')
            .query({ workspaceId: otherWorkspaceId })
            .expect(200);
        expect(second.body.total).toBe(1);
        expect(second.body.items[0].name).toBe('multi');
    });

    it('rejects an expiry in the past', async () => {
        const agent = await login(ADMIN_EMAIL);
        await agent
            .post('/api/api-tokens')
            .send({
                name: 'stale',
                workspaceIds: [workspaceId],
                scope: 'read',
                expiresAt: new Date(Date.now() - 60_000).toISOString()
            })
            .expect(400);
    });

    it('revokes a token', async () => {
        const agent = await login(ADMIN_EMAIL);
        const created = await agent
            .post('/api/api-tokens')
            .send({ name: 'temp', workspaceIds: [workspaceId], scope: 'full' })
            .expect(201);

        await agent.delete(`/api/api-tokens/${created.body.id}`).expect(204);

        const list = await agent.get('/api/api-tokens').expect(200);
        const [item] = list.body.items;
        // `revokedAt` is the wire signal; the admin derives its
        // active/expired/revoked badge from it (the view carries no `status`).
        expect(item.revokedAt).not.toBeNull();
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
            .send({ name: 'nope', workspaceIds: [workspaceId], scope: 'read' })
            .expect(403);
    });

    it('requires authentication', async () => {
        await request(harness.server).get('/api/api-tokens').expect(401);
    });
});
