import request from 'supertest';
import sharp from 'sharp';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    countMediaAssets,
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
const ADMIN = 'media-assets-admin@example.com';
const VIEWER = 'media-assets-viewer@example.com';
/** A contributor with `users.name` left null — pins the email fallback. */
const NAMELESS = 'media-assets-nameless@example.com';
const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');

/**
 * `/api/media/assets` — multipart upload, streaming download, listing, patch
 * (rename/move), duplicate, bulk delete, plus authz + workspace scoping.
 */
describe('media assets', () => {
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

    /** Uploads the PNG to the root and returns the created asset view. */
    async function upload(
        agent: ReturnType<typeof request.agent>,
        name = 'logo.png'
    ) {
        const res = await agent
            .post('/api/media/assets')
            .attach('file', PNG, { filename: name, contentType: 'image/png' })
            .expect(201);
        return res.body;
    }

    it('uploads a file and persists the asset', async () => {
        const agent = await login();

        const asset = await upload(agent);
        expect(asset).toMatchObject({
            id: expect.any(String),
            name: 'logo.png',
            kind: 'image',
            mimeType: 'image/png',
            folderId: null,
            uploadedBy: 'Media Admin',
            url: expect.stringContaining('/api/media/assets/'),
            size: PNG.length
        });
        expect(asset.url).toContain('/raw');
        await expect(countMediaAssets(workspace.id)).resolves.toBe(1);
    });

    it('falls back to the uploader’s email when they have no display name', async () => {
        // `users.name` is nullable and stays null until someone sets it — an
        // un-personalized invite, or a root admin provisioned without a name.
        // That must read as the person, not "Unknown".
        const nameless = await seedActiveUser(harness.app, {
            email: NAMELESS,
            password: PASSWORD,
            role: 'contributor'
        });
        await seedMembership(nameless.id, workspace.id);

        const asset = await upload(await login(NAMELESS));

        expect(asset.uploadedBy).toBe(NAMELESS);
    });

    it('uploads into a folder when folderId is given', async () => {
        const agent = await login();
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Images'
        });

        const res = await agent
            .post('/api/media/assets')
            .field('folderId', folder.id)
            .attach('file', PNG, {
                filename: 'a.png',
                contentType: 'image/png'
            })
            .expect(201);
        expect(res.body.folderId).toBe(folder.id);
    });

    it('streams the uploaded bytes back on download', async () => {
        const agent = await login();
        const asset = await upload(agent);

        const res = await agent
            .get(`/api/media/assets/${asset.id}/raw`)
            .expect(200);
        expect(res.headers['content-type']).toContain('image/png');
        expect(Number(res.headers['content-length'])).toBe(PNG.length);
    });

    it('lists a folder page and the workspace root', async () => {
        const agent = await login();
        await upload(agent, 'one.png');
        await upload(agent, 'two.png');

        const res = await agent.get('/api/media/assets').expect(200);
        expect(res.body).toMatchObject({ page: 1, total: 2 });
        expect(res.body.items).toHaveLength(2);
    });

    // The browse controls belong to the server: the admin used to apply them in
    // the browser over one fixed page of 100, so "oldest" returned the newest
    // hundred in ascending order and a search could miss a file that existed.
    describe('browsing a folder', () => {
        /** Six root assets, named and tagged so each control is decidable. */
        async function seedLibrary() {
            const names = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
            for (const name of names) {
                await seedMediaAsset({
                    workspaceId: workspace.id,
                    uploadedBy: admin.id,
                    name: `${name}.pdf`
                });
            }
            await seedMediaAsset({
                workspaceId: workspace.id,
                uploadedBy: admin.id,
                name: 'untitled.png',
                kind: 'image',
                mimeType: 'image/png',
                tags: ['seasonal', 'campaign']
            });
        }

        it('pages, and reports the whole-folder total with each page', async () => {
            const agent = await login();
            await seedLibrary();

            const first = await agent
                .get('/api/media/assets?page=1&pageSize=2&sort=name-asc')
                .expect(200);
            expect(first.body).toMatchObject({ total: 6, page: 1 });
            expect(
                first.body.items.map((a: { name: string }) => a.name)
            ).toEqual(['alpha.pdf', 'bravo.pdf']);

            // The total is the folder's, not the page's — it is what the pager
            // counts pages from, and returning `items.length` would report one
            // page however many there are.
            const third = await agent
                .get('/api/media/assets?page=3&pageSize=2&sort=name-asc')
                .expect(200);
            expect(third.body.total).toBe(6);
            expect(
                third.body.items.map((a: { name: string }) => a.name)
            ).toEqual(['echo.pdf', 'untitled.png']);
        });

        it('sorts over the whole folder, not over one page of it', async () => {
            const agent = await login();
            await seedLibrary();

            // The bug this pins: asking for the first page of "name-desc" has
            // to return the *last* names, which a page-scoped sort cannot do.
            const res = await agent
                .get('/api/media/assets?page=1&pageSize=2&sort=name-desc')
                .expect(200);
            expect(res.body.items.map((a: { name: string }) => a.name)).toEqual(
                ['untitled.png', 'echo.pdf']
            );
        });

        it('searches names and tags, and counts only the matches', async () => {
            const agent = await login();
            await seedLibrary();

            const byName = await agent
                .get('/api/media/assets?search=charlie')
                .expect(200);
            expect(byName.body.total).toBe(1);
            expect(byName.body.items[0].name).toBe('charlie.pdf');

            // Tags were searchable while the filter ran in the browser; moving
            // it to the server would have dropped them silently.
            const byTag = await agent
                .get('/api/media/assets?search=seasonal')
                .expect(200);
            expect(byTag.body.total).toBe(1);
            expect(byTag.body.items[0].name).toBe('untitled.png');
        });

        it('filters by kind alongside the search', async () => {
            const agent = await login();
            await seedLibrary();

            const res = await agent
                .get('/api/media/assets?kind=image')
                .expect(200);
            expect(res.body.total).toBe(1);
            expect(res.body.items[0].name).toBe('untitled.png');
        });
    });

    it('renames and moves an asset via PATCH', async () => {
        const agent = await login();
        const asset = await upload(agent);
        const folder = await seedMediaFolder({
            workspaceId: workspace.id,
            name: 'Dest'
        });

        const renamed = await agent
            .patch(`/api/media/assets/${asset.id}`)
            .send({ name: 'renamed.png', folderId: folder.id })
            .expect(200);
        expect(renamed.body).toMatchObject({
            name: 'renamed.png',
            folderId: folder.id
        });
    });

    it('duplicates an asset', async () => {
        const agent = await login();
        const asset = await upload(agent);

        const copy = await agent
            .post(`/api/media/assets/${asset.id}/duplicate`)
            .expect(201);
        expect(copy.body.name).toBe('logo copy.png');
        await expect(countMediaAssets(workspace.id)).resolves.toBe(2);
    });

    it('bulk-deletes assets', async () => {
        const agent = await login();
        const a = await upload(agent, 'a.png');
        const b = await upload(agent, 'b.png');

        const res = await agent
            .delete('/api/media/assets')
            .send({ ids: [a.id, b.id] })
            .expect(200);
        expect(res.body).toEqual({ deleted: 2 });
        await expect(countMediaAssets(workspace.id)).resolves.toBe(0);
    });

    /**
     * On upload, raster images are probed for dimensions and get WebP
     * derivatives — `thumb` (<=320px) + `preview` (<=1280px) — served from the
     * raw route via `?variant=`. These need *real* decodable bytes (the module
     * `PNG` is a fake, which is exactly why it exercises the graceful "no
     * derivatives" path below), so they synthesize images with Sharp.
     */
    describe('image derivatives', () => {
        /** A solid-colour PNG of the given size — real, Sharp-decodable bytes. */
        async function makeImage(
            width: number,
            height: number
        ): Promise<Buffer> {
            return sharp({
                create: {
                    width,
                    height,
                    channels: 3,
                    background: { r: 10, g: 120, b: 200 }
                }
            })
                .png()
                .toBuffer();
        }

        async function uploadImage(
            agent: ReturnType<typeof request.agent>,
            bytes: Buffer,
            filename = 'photo.png'
        ) {
            const res = await agent
                .post('/api/media/assets')
                .attach('file', bytes, { filename, contentType: 'image/png' })
                .expect(201);
            return res.body;
        }

        it('probes dimensions and generates thumb + preview for a large image', async () => {
            const agent = await login();
            const asset = await uploadImage(agent, await makeImage(800, 600));

            expect(asset).toMatchObject({ width: 800, height: 600 });
            // Order isn't asserted — jsonb doesn't preserve object key order.
            expect(asset.variants).toEqual(
                expect.arrayContaining(['thumb', 'preview'])
            );
            expect(asset.variants).toHaveLength(2);

            for (const variant of ['thumb', 'preview']) {
                const res = await agent
                    .get(`/api/media/assets/${asset.id}/raw?variant=${variant}`)
                    .expect(200);
                expect(res.headers['content-type']).toContain('image/webp');
                expect(Number(res.headers['content-length'])).toBeGreaterThan(
                    0
                );
            }
        });

        it('skips preview for a small image but still makes a thumb', async () => {
            const agent = await login();
            const asset = await uploadImage(agent, await makeImage(100, 80));

            expect(asset).toMatchObject({ width: 100, height: 80 });
            expect(asset.variants).toEqual(['thumb']);
        });

        it('serves the original when the requested variant does not exist [media:I-10] [media:I-23]', async () => {
            const agent = await login();
            // The fake PNG can't be decoded, so no derivatives are produced —
            // the upload still succeeds and the row carries none.
            const asset = await upload(agent);
            expect(asset.variants).toEqual([]);
            expect(asset).toMatchObject({ width: null, height: null });

            const res = await agent
                .get(`/api/media/assets/${asset.id}/raw?variant=thumb`)
                .expect(200);
            expect(res.headers['content-type']).toContain('image/png');
            expect(Number(res.headers['content-length'])).toBe(PNG.length);
        });

        it('falls back to the original for a bogus ?variant= [media:I-23]', async () => {
            const agent = await login();
            const asset = await uploadImage(agent, await makeImage(600, 400));

            // `variants` is a plain JSON object, so a prototype member name
            // must not be mistaken for a stored derivative — indexing it bare
            // returned a truthy non-variant, and the provider then got an
            // `undefined` key.
            for (const variant of ['nope', 'toString', 'constructor']) {
                const res = await agent
                    .get(`/api/media/assets/${asset.id}/raw?variant=${variant}`)
                    .expect(200);
                expect(res.headers['content-type']).toContain('image/png');
            }
        });

        it('produces no derivatives for a non-image upload', async () => {
            const agent = await login();
            const res = await agent
                .post('/api/media/assets')
                .attach('file', Buffer.from('plain text'), {
                    filename: 'notes.txt',
                    contentType: 'text/plain'
                })
                .expect(201);

            expect(res.body.kind).toBe('document');
            expect(res.body.variants).toEqual([]);
            expect(res.body).toMatchObject({ width: null, height: null });
        });

        it('carries the derivatives onto a duplicated image', async () => {
            const agent = await login();
            const asset = await uploadImage(agent, await makeImage(800, 600));

            const copy = await agent
                .post(`/api/media/assets/${asset.id}/duplicate`)
                .expect(201);
            expect(copy.body.variants).toEqual(
                expect.arrayContaining(['thumb', 'preview'])
            );
            expect(copy.body.variants).toHaveLength(2);

            const res = await agent
                .get(`/api/media/assets/${copy.body.id}/raw?variant=thumb`)
                .expect(200);
            expect(res.headers['content-type']).toContain('image/webp');
        });
    });

    describe('validation', () => {
        it('rejects an upload with no file (400)', async () => {
            const agent = await login();
            await agent.post('/api/media/assets').expect(400);
        });

        it('rejects an unknown body field (400)', async () => {
            const agent = await login();
            await agent
                .post('/api/media/assets')
                .field('bogus', 'x')
                .attach('file', PNG, {
                    filename: 'a.png',
                    contentType: 'image/png'
                })
                .expect(400);
        });
    });

    describe('authorization', () => {
        it('rejects an unauthenticated upload with 401', async () => {
            await request(harness.server)
                .post('/api/media/assets')
                .set('X-Workspace-Id', workspace.id)
                .attach('file', PNG, {
                    filename: 'a.png',
                    contentType: 'image/png'
                })
                .expect(401);
        });

        it('forbids a viewer from uploading (403)', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: VIEWER,
                password: PASSWORD,
                role: 'viewer'
            });
            await seedMembership(viewer.id, workspace.id);
            const agent = await login(VIEWER);

            await agent
                .post('/api/media/assets')
                .attach('file', PNG, {
                    filename: 'a.png',
                    contentType: 'image/png'
                })
                .expect(403);
        });
    });

    it('never returns an asset from another workspace (404)', async () => {
        const other = await seedWorkspace({ name: 'Other', slug: 'other' });
        await seedMembership(admin.id, other.id);
        const otherAgent = request.agent(harness.server);
        await otherAgent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        const foreign = await otherAgent
            .post('/api/media/assets')
            .set('X-Workspace-Id', other.id)
            .attach('file', PNG, {
                filename: 'x.png',
                contentType: 'image/png'
            })
            .expect(201);

        // The *listing* stays header-scoped: workspace 1 never sees it.
        const agent = await login();
        const listed = await agent.get('/api/media/assets').expect(200);
        expect(
            listed.body.items.some(
                (item: { id: string }) => item.id === foreign.body.id
            )
        ).toBe(false);
    });

    /**
     * The raw route is the one media route without `WorkspaceGuard` — an `<img>`
     * tag can't send `X-Workspace-Id` — so it derives the workspace from the
     * asset row and authorizes on membership instead. These two pin that
     * contract: a member of the *owning* workspace reads it whatever the header
     * says, and a non-member never does.
     */
    describe('raw download scope', () => {
        it('streams to a member of the owning workspace, ignoring the header [media:I-16]', async () => {
            const other = await seedWorkspace({ name: 'Other', slug: 'other' });
            await seedMembership(admin.id, other.id);
            const otherAgent = request.agent(harness.server);
            await otherAgent
                .post('/api/auth/login')
                .send({ email: ADMIN, password: PASSWORD })
                .expect(201);
            const foreign = await otherAgent
                .post('/api/media/assets')
                .set('X-Workspace-Id', other.id)
                .attach('file', PNG, {
                    filename: 'x.png',
                    contentType: 'image/png'
                })
                .expect(201);

            // Scoped to workspace 1, but admin is a member of `other` — which
            // is what actually grants the read.
            const agent = await login();
            const res = await agent
                .get(`/api/media/assets/${foreign.body.id}/raw`)
                .expect(200);
            expect(res.headers['content-type']).toContain('image/png');
        });

        it('404s for a user who is not a member of the owning workspace [media:I-16]', async () => {
            const asset = await upload(await login());

            // A viewer holds `media:read` (so this clears PermissionsGuard and
            // genuinely exercises the membership check) but joins no workspace.
            await seedActiveUser(harness.app, {
                email: VIEWER,
                password: PASSWORD,
                role: 'viewer'
            });
            const outsider = request.agent(harness.server);
            await outsider
                .post('/api/auth/login')
                .send({ email: VIEWER, password: PASSWORD })
                .expect(201);

            await outsider.get(`/api/media/assets/${asset.id}/raw`).expect(404);
        });
    });
});
