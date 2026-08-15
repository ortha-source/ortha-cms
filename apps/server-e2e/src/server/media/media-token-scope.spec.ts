import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-token-scope-admin@example.com';
const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');

/**
 * `GET /api/v1/media/assets/:id/raw` — the token route's workspace boundary.
 *
 * A session download derives its scope from **membership**, which a token has
 * none of, so this route derives it from the token's resolved workspace
 * instead. The rule worth pinning is the strict one: an asset in **another
 * workspace inside the same token's bucket** is a 404 too, so `X-Workspace-Id`
 * stays binding rather than advisory.
 */
describe('media token download scope', () => {
    let harness: TestApp;
    let first: SeededWorkspace;
    let second: SeededWorkspace;
    let secret: string;
    let assetInSecond: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });
    afterAll(async () => {
        await closeTestApp(harness);
    });
    beforeEach(async () => {
        await resetDb();
        const admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        first = await seedWorkspace({ name: 'First', slug: 'first' });
        second = await seedWorkspace({ name: 'Second', slug: 'second' });
        await seedMembership(admin.id, first.id);
        await seedMembership(admin.id, second.id);

        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        const upload = await agent
            .post('/api/media/assets')
            .set('X-Workspace-Id', second.id)
            .attach('file', PNG, {
                filename: 'logo.png',
                contentType: 'image/png'
            })
            .expect(201);
        assetInSecond = upload.body.id;

        // One token covering BOTH workspaces — the case where the boundary is
        // the header rather than the bucket.
        const minted = await agent
            .post('/api/api-tokens')
            .send({
                name: 'two-workspaces',
                workspaceIds: [first.id, second.id],
                scope: 'read'
            })
            .expect(201);
        secret = minted.body.secret;
    });

    it('serves the bytes when the header names the owning workspace', async () => {
        await request(harness.server)
            .get(`/api/v1/media/assets/${assetInSecond}/raw`)
            .set('Authorization', `Bearer ${secret}`)
            .set('X-Workspace-Id', second.id)
            .expect(200);
    });

    it('404s when the header names another workspace in the same bucket', async () => {
        await request(harness.server)
            .get(`/api/v1/media/assets/${assetInSecond}/raw`)
            .set('Authorization', `Bearer ${secret}`)
            .set('X-Workspace-Id', first.id)
            .expect(404);
    });

    it('400s a multi-workspace token that names no workspace at all', async () => {
        await request(harness.server)
            .get(`/api/v1/media/assets/${assetInSecond}/raw`)
            .set('Authorization', `Bearer ${secret}`)
            .expect(400);
    });
});
