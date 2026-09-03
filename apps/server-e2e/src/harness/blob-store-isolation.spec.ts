import request from 'supertest';
import { closeTestApp, createTestApp, type TestApp } from '../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../support/seed';
import { blobStoreKeys } from '../support/media-storage';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'blob-store-admin@example.com';
const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');

/**
 * The bytes behind a media asset, which no spec could previously see.
 *
 * The in-memory provider closes over its `Map` and `buildTestPlugins`
 * constructs it, so "delete removed the bytes" was unassertable and the blobs
 * outlived every `resetDb` that truncated the rows naming them. Both halves are
 * asserted here — the delete path, and the isolation that keeps an orphaned
 * blob from answering a later test's download.
 */
describe('media blob store', () => {
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
            role: 'admin'
        });
        workspace = await seedWorkspace({ name: 'Blobs', slug: 'blobs' });
        await seedMembership(admin.id, workspace.id);
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    it('holds the bytes after an upload and drops them on delete [media:I-12]', async () => {
        const agent = await login();
        expect(blobStoreKeys()).toHaveLength(0);

        const asset = await agent
            .post('/api/media/assets')
            .attach('file', PNG, {
                filename: 'logo.png',
                contentType: 'image/png'
            })
            .expect(201);

        const keys = blobStoreKeys();
        expect(keys).not.toHaveLength(0);
        expect(keys.some((key) => key.startsWith(`${workspace.id}/`))).toBe(
            true
        );

        await agent
            .delete('/api/media/assets')
            .send({ ids: [asset.body.id] })
            .expect(200);

        // The row going away is not the claim — the bytes going away is.
        expect(blobStoreKeys()).toHaveLength(0);
    });

    it('starts every test with no blobs left over from the last one', async () => {
        // Depends on the test above having uploaded. `resetDb` truncates
        // `media_asset`, so any surviving blob is one no row names — free to
        // satisfy a download for a `storage_key` a later test reproduces.
        expect(blobStoreKeys()).toHaveLength(0);
    });
});
