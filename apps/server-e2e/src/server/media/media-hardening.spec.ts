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
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-hardening-admin@example.com';

const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');
const HTML = Buffer.from('<html><body><script>alert(1)</script></body></html>');
const SVG = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
);

/**
 * The hardening + input-validation half of the media API — the behaviours a
 * status code alone hides, and every one a QA finding on ORT-74.
 *
 * Grouped in its own file rather than bolted onto `media-assets.spec.ts`,
 * which covers the CRUD happy paths — these are the cases where the status code
 * is the least interesting part of the response.
 */
describe('media hardening', () => {
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

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return agent;
    }

    async function upload(
        agent: ReturnType<typeof request.agent>,
        body: Buffer,
        filename: string,
        contentType: string
    ) {
        const res = await agent
            .post('/api/media/assets')
            .attach('file', body, { filename, contentType })
            .expect(201);
        return res.body as { id: string };
    }

    /**
     * `media_asset.mime_type` is whatever the uploader's multipart part claimed
     * — nothing sniffs the bytes — and the download route is same-origin with
     * the admin. Served naively an uploaded `.html` is stored XSS, so the
     * response has to be inert regardless of what the type says.
     */
    describe('download hardening', () => {
        it('serves an uploaded HTML file as an inert attachment', async () => {
            const agent = await login();
            const asset = await upload(agent, HTML, 'x.html', 'text/html');

            const res = await agent
                .get(`/api/media/assets/${asset.id}/raw`)
                .expect(200);

            expect(res.headers['content-disposition']).toMatch(/^attachment;/);
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['content-security-policy']).toContain('sandbox');
            expect(res.headers['content-security-policy']).toContain(
                "default-src 'none'"
            );
        });

        it('serves a scripted SVG as an attachment too [media:I-19]', async () => {
            // SVG is an image, but also a scriptable document when navigated to
            // directly — and `MediaKind` files it as `kind: 'image'`, so it
            // would otherwise ride the image allowance. `<img src>` ignores
            // Content-Disposition, so the library's tiles still render it.
            const agent = await login();
            const asset = await upload(agent, SVG, 'evil.svg', 'image/svg+xml');

            const res = await agent
                .get(`/api/media/assets/${asset.id}/raw`)
                .expect(200);

            expect(res.headers['content-disposition']).toMatch(/^attachment;/);
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('keeps a raster image inline, still with nosniff + CSP', async () => {
            const agent = await login();
            const asset = await upload(agent, PNG, 'logo.png', 'image/png');

            const res = await agent
                .get(`/api/media/assets/${asset.id}/raw`)
                .expect(200);

            expect(res.headers['content-disposition']).toMatch(/^inline;/);
            expect(res.headers['content-type']).toBe('image/png');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['content-security-policy']).toContain('sandbox');
        });

        it('hardens the token-authenticated /v1 download the same way [media:I-19]', async () => {
            const agent = await login();
            const asset = await upload(agent, HTML, 'x.html', 'text/html');
            const minted = await agent
                .post('/api/api-tokens')
                .send({
                    name: 'media-hardening',
                    workspaceIds: [workspace.id],
                    scope: 'read'
                })
                .expect(201);

            const res = await request(harness.server)
                .get(`/api/v1/media/assets/${asset.id}/raw`)
                .set('Authorization', `Bearer ${minted.body.secret}`)
                .expect(200);

            expect(res.headers['content-disposition']).toMatch(/^attachment;/);
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['content-security-policy']).toContain('sandbox');
        });
    });

    /**
     * `folder_id` is a `uuid` column and `kind` is the `media_kind` enum, so an
     * unparseable filter used to reach Postgres and come back as a 500 for what
     * is plainly a bad request.
     */
    describe('list filters', () => {
        it('rejects a non-uuid folderId with 400, not 500 [media:I-24]', async () => {
            const agent = await login();

            const res = await agent
                .get('/api/media/assets')
                .query({ folderId: 'not-a-uuid' })
                .expect(400);

            expect(res.body.message).toContain('folderId');
        });

        it('rejects an unknown kind with 400, not 500 [media:I-24]', async () => {
            const agent = await login();

            const res = await agent
                .get('/api/media/assets')
                .query({ kind: 'bogus' })
                .expect(400);

            expect(res.body.message).toContain('kind');
        });

        it('still accepts the sentinel filter values', async () => {
            const agent = await login();

            // `kind=all` means every kind and an empty `folderId` means the
            // workspace root — neither is a value the columns hold, so both
            // have to survive the new validation.
            await agent
                .get('/api/media/assets')
                .query({ kind: 'all', folderId: '' })
                .expect(200);
            await agent
                .get('/api/media/assets')
                .query({ kind: 'image' })
                .expect(200);
        });

        it('treats % and _ in ?search= as literal characters [media:I-24]', async () => {
            const agent = await login();
            await upload(agent, PNG, 'logo.png', 'image/png');
            await upload(agent, PNG, 'a_b.png', 'image/png');
            await upload(agent, PNG, '100%.png', 'image/png');

            // Unescaped, `_` was a single-character wildcard and `%` matched
            // everything — a filter that silently ignored what it was given.
            const underscore = await agent
                .get('/api/media/assets')
                .query({ search: '_' })
                .expect(200);
            expect(underscore.body.total).toBe(1);
            expect(underscore.body.items[0].name).toBe('a_b.png');

            const percent = await agent
                .get('/api/media/assets')
                .query({ search: '%' })
                .expect(200);
            expect(percent.body.total).toBe(1);
            expect(percent.body.items[0].name).toBe('100%.png');
        });
    });

    it('duplicates to a 400 when " copy" overflows the name limit', async () => {
        // 251 + " copy" = 260 characters, past `FileName`'s 255. The name is
        // now built before anything touches storage, so this is a validation
        // error rather than the provider's unmapped ENAMETOOLONG (a 500).
        const agent = await login();
        const asset = await upload(
            agent,
            PNG,
            `${'z'.repeat(251)}.png`,
            'image/png'
        );

        await agent.post(`/api/media/assets/${asset.id}/duplicate`).expect(400);
    });

    it('lets two sibling folders share a name', async () => {
        // Documented here because `CreateFolderDto` used to claim the opposite:
        // there is no unique index on (workspace_id, parent_id, name) and no
        // check in the use case.
        const agent = await login();

        await agent
            .post('/api/media/folders')
            .send({ name: 'Brand' })
            .expect(201);
        await agent
            .post('/api/media/folders')
            .send({ name: 'Brand' })
            .expect(201);

        const res = await agent.get('/api/media/folders').expect(200);
        expect(
            res.body.folders.filter(
                (folder: { name: string }) => folder.name === 'Brand'
            )
        ).toHaveLength(2);
    });
});
