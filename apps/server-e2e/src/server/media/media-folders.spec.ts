import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
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
 * the cascading delete (a folder takes its whole subtree with it).
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
        workspace = await seedWorkspace({
            name: 'Workspace',
            slug: 'workspace'
        });
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

    it('deletes a non-empty folder together with everything inside it', async () => {
        const agent = await login();
        const parent = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Campaign'
        });
        const child = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Drafts',
            parentId: parent.id
        });
        await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'brief.pdf',
            folderId: parent.id
        });
        const nested = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'draft.pdf',
            folderId: child.id
        });
        // A sibling outside the subtree must survive — the cascade is scoped to
        // the folder it was asked about, not "everything that looks related".
        const untouched = await seedMediaAsset({
            workspaceId: workspace.id,
            uploadedBy: admin.id,
            name: 'keep.pdf',
            folderId: null
        });

        await agent.delete(`/api/media/folders/${parent.id}`).expect(204);

        const folders = await agent.get('/api/media/folders').expect(200);
        expect(folders.body.folders).toHaveLength(0);

        const assets = await agent.get('/api/media/assets').expect(200);
        expect(
            assets.body.items.map((item: { id: string }) => item.id)
        ).toEqual([untouched.id]);
        // The nested asset is gone for good, bytes included.
        await agent.get(`/api/media/assets/${nested.id}/raw`).expect(404);
    });

    it('cascades only inside the caller\u2019s workspace', async () => {
        // A recursive walk with a missing workspace filter would reach across
        // tenants, so pin it: two workspaces, same-shaped trees, one delete.
        const other = await seedWorkspace({ name: 'Other', slug: 'other-ws' });
        await seedMembership(admin.id, other.id);
        const mine = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Shared name'
        });
        const theirs = await seedMediaFolder({
            workspaceId: other.id,
            name: 'Shared name'
        });
        const theirAsset = await seedMediaAsset({
            workspaceId: other.id,
            uploadedBy: admin.id,
            name: 'theirs.pdf',
            folderId: theirs.id
        });

        const agent = await login();
        await agent.delete(`/api/media/folders/${mine.id}`).expect(204);

        const otherAgent = await login();
        otherAgent.set('X-Workspace-Id', other.id);
        const folders = await otherAgent.get('/api/media/folders').expect(200);
        expect(folders.body.folders).toHaveLength(1);
        // Still listed inside their folder. (Asserted through the API rather
        // than `/raw`: a seeded asset is a row with no blob behind it.)
        const theirAssets = await otherAgent
            .get(`/api/media/assets?folderId=${theirs.id}`)
            .expect(200);
        expect(theirAssets.body.items.map((a: { id: string }) => a.id)).toEqual(
            [theirAsset.id]
        );
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
