import request from 'supertest';
import { closeTestApp, createTestApp, type TestApp } from '../../support/test-app';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';
import {
    resetDb,
    seedActiveUser,
    seedMediaAsset,
    seedMediaFolder,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-folders-admin@example.com';
const VIEWER = 'media-folders-viewer@example.com';

/**
 * `/api/media/folders` — create, list (with the root asset count), rename, and
 * the empty-only delete (409 when the folder still holds assets).
 */
describe('media folders', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp();
    });
    afterAll(async () => {
        await closeTestApp(harness);
    });
    beforeEach(async () => {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin',
            name: 'Media Admin'
        });
        workspace = await seedWorkspace({ name: 'Workspace', slug: 'workspace' });
        await seedMembership(admin.id, workspace.id);
    });

    async function login(email = ADMIN) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    it('creates a folder and lists it with the root count', async () => {
        const agent = await login();

        const created = await agent
            .post('/api/media/folders')
            .send({ name: 'Images' })
            .expect(201);
        expect(created.body).toEqual({ id: expect.any(String) });

        const res = await agent.get('/api/media/folders').expect(200);
        expect(res.body.rootAssetCount).toBe(0);
        expect(res.body.folders).toHaveLength(1);
        expect(res.body.folders[0]).toMatchObject({
            id: created.body.id,
            name: 'Images',
            parentId: null,
            assetCount: 0
        });
    });

    it('renames a folder', async () => {
        const agent = await login();
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Old'
        });

        await agent
            .patch(`/api/media/folders/${folder.id}`)
            .send({ name: 'New' })
            .expect(200);

        const res = await agent.get('/api/media/folders').expect(200);
        expect(res.body.folders[0].name).toBe('New');
    });

    it('deletes an empty folder (204)', async () => {
        const agent = await login();
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Empty'
        });

        await agent.delete(`/api/media/folders/${folder.id}`).expect(204);

        const res = await agent.get('/api/media/folders').expect(200);
        expect(res.body.folders).toHaveLength(0);
    });

    it('refuses to delete a non-empty folder with 409', async () => {
        const agent = await login();
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Full'
        });
        await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'file.pdf',
            folderId: folder.id
        });

        await agent.delete(`/api/media/folders/${folder.id}`).expect(409);
    });

    describe('authorization', () => {
        it('rejects an unauthenticated request with 401', async () => {
            await request(harness.server)
                .get('/api/media/folders')
                .set('X-Workspace-Id', workspace.id)
                .expect(401);
        });

        it('forbids a viewer from creating a folder (403)', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: VIEWER,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewer.id, workspace.id);
            const agent = await login(VIEWER);

            await agent
                .post('/api/media/folders')
                .send({ name: 'Nope' })
                .expect(403);
        });

        it('lets a viewer read folders (200)', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: VIEWER,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewer.id, workspace.id);
            const agent = await login(VIEWER);

            await agent.get('/api/media/folders').expect(200);
        });

        it('rejects a disallowed Origin on create (403)', async () => {
            const agent = await login();
            await agent
                .post('/api/media/folders')
                .set('Origin', 'http://evil.example')
                .send({ name: 'x' })
                .expect(403);
        });

        it('allows the configured Origin on create', async () => {
            const agent = await login();
            await agent
                .post('/api/media/folders')
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({ name: 'ok' })
                .expect(201);
        });
    });
});
