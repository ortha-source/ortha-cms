import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { SIGNED_URL_HOST } from '../../support/media-storage';
import {
    resetDb,
    seedActiveUser,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-direct-admin@example.com';
const OUTSIDER = 'media-direct-outsider@example.com';

const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');
const HTML = Buffer.from('<html><body><script>alert(1)</script></body></html>');

/**
 * Direct serve: `GET /media/assets/:id/raw` answers **302 to a signed URL**
 * instead of streaming, when the deployment asked for it and the backend can
 * mint one.
 *
 * What is only true end to end, and is the whole risk of the feature:
 *
 * - the redirect happens **after** authorization, never instead of it, so a
 *   non-member still gets the same 404 rather than a URL to the bytes;
 * - the disposition is decided by the app and pinned onto the URL, because the
 *   redirect discards this response's `Content-Disposition`, `nosniff` and CSP
 *   — an uploaded `.html` must not become inline HTML on the bucket's origin.
 *
 * The harness's signing provider returns those options in the URL's query
 * rather than a real signature: the decision is the app's, and a real signature
 * would need a bucket to prove nothing extra. `directUrlFor`'s own unit suite
 * covers the mapping table.
 */
describe('media direct serve', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp({
            directServe: 'signed-url',
            directServeTtlSeconds: 42
        });
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

    it('redirects an image to a signed URL instead of streaming it [media:I-20]', async () => {
        const agent = await login();
        const asset = await upload(agent, PNG, 'logo.png', 'image/png');

        const res = await agent
            .get(`/api/media/assets/${asset.id}/raw`)
            .expect(302);

        const location = new URL(res.headers['location'] as string);
        expect(location.origin).toBe(SIGNED_URL_HOST);
        expect(location.searchParams.get('disposition')).toBe('inline');
        expect(location.searchParams.get('type')).toBe('image/png');
        // The configured lifetime reaches the provider, rather than a default
        // invented somewhere in the middle.
        expect(location.searchParams.get('ttl')).toBe('42');
    });

    it('never caches the redirect, which outlives the URL it points at [media:I-20]', async () => {
        const agent = await login();
        const asset = await upload(agent, PNG, 'logo.png', 'image/png');

        const res = await agent
            .get(`/api/media/assets/${asset.id}/raw`)
            .expect(302);

        expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('signs an uploaded .html as an attachment', async () => {
        // The case the feature turns on. A redirect drops our own
        // `Content-Disposition`, `nosniff` and CSP, and the MIME type is the
        // uploader's own claim — served inline from the bucket this is stored
        // XSS on that origin.
        const agent = await login();
        const asset = await upload(agent, HTML, 'evil.html', 'text/html');

        const res = await agent
            .get(`/api/media/assets/${asset.id}/raw`)
            .expect(302);

        const location = new URL(res.headers['location'] as string);
        expect(location.searchParams.get('disposition')).toBe('attachment');
    });

    it('authorizes before it redirects — a non-member gets the same 404 [media:I-20]', async () => {
        // The one that matters: a redirect issued before the membership check
        // would hand the bytes to anyone holding an asset id, and the app would
        // never see the request that fetched them.
        const agent = await login();
        const asset = await upload(agent, PNG, 'logo.png', 'image/png');

        await seedActiveUser(harness.app, {
            email: OUTSIDER,
            password: PASSWORD,
            role: 'admin',
            name: 'Outsider'
        });
        const outsider = await login(OUTSIDER);

        await outsider.get(`/api/media/assets/${asset.id}/raw`).expect(404);
    });

    it('still 404s an asset that does not exist [media:I-17]', async () => {
        const agent = await login();

        await agent
            .get('/api/media/assets/11111111-1111-4111-8111-111111111111/raw')
            .expect(404);
    });
});

/** The default: nothing is redirected, and the hardening headers are ours. */
describe('media direct serve, off by default', () => {
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

    it('streams the bytes through the app', async () => {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        const res = await agent
            .post('/api/media/assets')
            .attach('file', PNG, {
                filename: 'logo.png',
                contentType: 'image/png'
            })
            .expect(201);
        const asset = res.body as { id: string };

        const download = await agent
            .get(`/api/media/assets/${asset.id}/raw`)
            .expect(200);

        expect(download.headers['x-content-type-options']).toBe('nosniff');
        expect(download.headers['content-disposition']).toContain('inline');
        expect(download.body).toEqual(PNG);
    });
});
