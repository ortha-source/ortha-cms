import request from 'supertest';
import sharp from 'sharp';
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

    it('frees every blob a failed upload wrote, derivatives included [media:I-11]', async () => {
        const agent = await login();
        // A *real* image, not the fake PNG above: the claim is about the
        // derivatives as much as the original, and Sharp writes none for bytes
        // it cannot decode — so the fake would leave one blob to reclaim and
        // pass against an implementation that only ever reclaims the original.
        const image = await sharp({
            create: {
                width: 800,
                height: 600,
                channels: 3,
                background: { r: 10, g: 120, b: 200 }
            }
        })
            .png()
            .toBuffer();
        expect(blobStoreKeys()).toHaveLength(0);

        // A well-formed uuid that names no folder: the bytes (and both
        // derivatives) are already in storage by the time the transaction looks
        // the folder up and throws.
        await agent
            .post('/api/media/assets')
            .field('folderId', '00000000-0000-4000-8000-000000000000')
            .attach('file', image, {
                filename: 'photo.png',
                contentType: 'image/png'
            })
            .expect(404);

        expect(blobStoreKeys()).toEqual([]);

        // How much was reclaimed, made visible: the same bytes accepted leave
        // three blobs behind — the original plus `thumb` and `preview`. That is
        // what the rejected upload would have leaked, with nothing left naming
        // any of it.
        await agent
            .post('/api/media/assets')
            .attach('file', image, {
                filename: 'photo.png',
                contentType: 'image/png'
            })
            .expect(201);
        expect(blobStoreKeys()).toHaveLength(3);
    });

    it('starts every test with no blobs left over from the last one', async () => {
        // Depends on the test above having uploaded. `resetDb` truncates
        // `media_asset`, so any surviving blob is one no row names — free to
        // satisfy a download for a `storage_key` a later test reproduces.
        expect(blobStoreKeys()).toHaveLength(0);
    });
});
