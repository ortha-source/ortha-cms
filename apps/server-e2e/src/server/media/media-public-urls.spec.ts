import request from 'supertest';
import sharp from 'sharp';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { PUBLIC_URL_HOST, VIDEO_URL_HOST } from '../../support/media-storage';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedArticles,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const ADMIN = 'media-public-admin@example.com';

const SVG = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
);
const MP4 = Buffer.from('\x00\x00\x00\x18ftypmp42fake-video', 'binary');

/** A real, Sharp-decodable PNG large enough to get both derivatives. */
function makeImage(): Promise<Buffer> {
    return sharp({
        create: {
            width: 1600,
            height: 1000,
            channels: 3,
            background: { r: 10, g: 120, b: 200 }
        }
    })
        .png()
        .toBuffer();
}

/** The URL fields an asset is reported with, on every surface. */
interface Urls {
    id: string;
    url: string;
    thumbUrl?: string;
    previewUrl?: string;
    streams?: { hls?: string; dash?: string };
}

/**
 * Public URLs (ADR-0021): a storage provider may publish permanent CDN URLs,
 * and the API reports them instead of its own authorized routes — **only** when
 * the operator sets `publicUrls: 'provider'`, and by default only for types a
 * browser renders inertly.
 *
 * Both halves boot the same publishing provider, so what is under test is the
 * operator's switch and the core's MIME gate, never a provider that happened
 * to decline. Every surface that reports a URL is covered: the library list,
 * a PATCH response (the post-write refetch), both upload routes, the editor's
 * resolver read, and the public API's `?media=preview`.
 */
describe('media public URLs', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspace: SeededWorkspace;

    async function seed() {
        await resetDb();
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin',
            name: 'Media Admin'
        });
        workspace = await seedWorkspace({ name: 'Workspace', slug: 'ws' });
        await seedMembership(admin.id, workspace.id);
        await seedAllContentGrants(workspace.id);
    }

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
    ): Promise<Urls> {
        const res = await agent
            .post('/api/media/assets')
            .attach('file', body, { filename, contentType })
            .expect(201);
        return res.body as Urls;
    }

    async function mintFullToken(
        agent: ReturnType<typeof request.agent>
    ): Promise<string> {
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'e2e',
                workspaceIds: [workspace.id],
                scope: 'full'
            })
            .expect(201);
        return res.body.secret as string;
    }

    async function tokenUpload(
        secret: string,
        body: Buffer,
        filename: string,
        contentType: string
    ): Promise<Urls> {
        const res = await request(harness.server)
            .post('/api/v1/media/assets')
            .set('Authorization', `Bearer ${secret}`)
            .attach('file', body, { filename, contentType })
            .expect(201);
        return res.body as Urls;
    }

    /** Uploads an image, an SVG and a video, and a published entry holding them. */
    async function seedLibrary() {
        const agent = await login();
        const image = await upload(
            agent,
            await makeImage(),
            'photo.png',
            'image/png'
        );
        const svg = await upload(agent, SVG, 'icon.svg', 'image/svg+xml');
        const video = await upload(agent, MP4, 'clip.mp4', 'video/mp4');
        const [entry] = await seedArticles(
            [
                {
                    text: 'With media',
                    select: 'article',
                    status: 'published',
                    publishedAt: new Date(),
                    attachments: [image.id, svg.id, video.id]
                }
            ],
            workspace.id
        );
        return { agent, image, svg, video, entry: entry as string };
    }

    /** The library page, keyed by asset id. */
    async function listed(agent: ReturnType<typeof request.agent>) {
        const res = await agent
            .get('/api/media/assets')
            .query({ pageSize: 50 })
            .expect(200);
        return new Map(
            (res.body.items as Urls[]).map((item) => [item.id, item])
        );
    }

    /** The editor's resolver read — content's `MEDIA_ASSET_RESOLVER`. */
    async function resolved(
        agent: ReturnType<typeof request.agent>,
        entry: string
    ) {
        const res = await agent
            .get(`/api/content/test_article/${entry}/media`)
            .expect(200);
        return new Map(
            (res.body.attachments as Urls[]).map((ref) => [ref.id, ref])
        );
    }

    /** The public API's `?media=preview` items, keyed by asset id. */
    async function expanded(secret: string, entry: string) {
        const res = await request(harness.server)
            .get(`/api/v1/content/test_article/${entry}`)
            .query({ media: 'preview', mediaFields: 'attachments' })
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);
        return new Map(
            (res.body.media.attachments.items as Urls[]).map((item) => [
                item.id,
                item
            ])
        );
    }

    const raw = (id: string) => `/api/media/assets/${id}/raw`;
    const tokenRaw = (id: string) => `/api/v1/media/assets/${id}/raw`;

    describe('off — the default, on a provider that could publish', () => {
        beforeAll(async () => {
            harness = await createTestApp({ publishingProvider: true });
        });
        afterAll(async () => {
            await closeTestApp(harness);
        });
        beforeEach(seed);

        it('reports the app’s own routes on every surface [media:I-41]', async () => {
            const { agent, image, svg, video, entry } = await seedLibrary();

            // Upload responses (session).
            expect(image.url).toBe(raw(image.id));
            expect(image.thumbUrl).toBe(`${raw(image.id)}?variant=thumb`);
            expect(image.previewUrl).toBe(`${raw(image.id)}?variant=preview`);
            expect(video.url).toBe(raw(video.id));
            expect(video).not.toHaveProperty('thumbUrl');
            expect(video).not.toHaveProperty('streams');
            expect(svg.url).toBe(raw(svg.id));

            // Library list, and a post-write refetch.
            const page = await listed(agent);
            for (const asset of [image, svg, video]) {
                expect(page.get(asset.id)?.url).toBe(raw(asset.id));
            }
            const patched = await agent
                .patch(`/api/media/assets/${image.id}`)
                .send({ alt: 'Blue' })
                .expect(200);
            expect(patched.body.url).toBe(raw(image.id));

            // Token upload response.
            const secret = await mintFullToken(agent);
            const viaToken = await tokenUpload(
                secret,
                await makeImage(),
                'token.png',
                'image/png'
            );
            expect(viaToken.url).toBe(raw(viaToken.id));

            // The editor's resolver read.
            const refs = await resolved(agent, entry);
            expect(refs.get(image.id)).toMatchObject({
                url: raw(image.id),
                thumbUrl: `${raw(image.id)}?variant=thumb`
            });
            expect(refs.get(video.id)?.url).toBe(raw(video.id));

            // `?media=preview` — the token route, no streams.
            const items = await expanded(secret, entry);
            expect(items.get(image.id)).toMatchObject({
                url: tokenRaw(image.id),
                thumbUrl: `${tokenRaw(image.id)}?variant=thumb`,
                previewUrl: `${tokenRaw(image.id)}?variant=preview`
            });
            expect(items.get(video.id)?.url).toBe(tokenRaw(video.id));
            expect(items.get(video.id)).not.toHaveProperty('streams');
            expect(items.get(svg.id)?.url).toBe(tokenRaw(svg.id));
        });
    });

    describe("'provider' — on", () => {
        beforeAll(async () => {
            harness = await createTestApp({ publicUrls: 'provider' });
        });
        afterAll(async () => {
            await closeTestApp(harness);
        });
        beforeEach(seed);

        it('reports an image’s CDN URL and its derivatives’ own keys', async () => {
            const { agent, image } = await seedLibrary();

            expect(image.url).toMatch(new RegExp(`^${PUBLIC_URL_HOST}/`));
            // Each derivative is asked about under its own storage key — not
            // `${url}?variant=…`, which a CDN would serve as the original.
            expect(image.thumbUrl).toMatch(
                new RegExp(`^${PUBLIC_URL_HOST}/.+/variants/`)
            );
            expect(image.previewUrl).toMatch(
                new RegExp(`^${PUBLIC_URL_HOST}/.+/variants/`)
            );
            expect(image.thumbUrl).not.toBe(image.previewUrl);
            expect(image.thumbUrl).not.toContain('?variant=');

            const page = await listed(agent);
            expect(page.get(image.id)).toMatchObject({
                url: image.url,
                thumbUrl: image.thumbUrl,
                previewUrl: image.previewUrl
            });
        });

        it('reports a video’s CDN URL, poster and streams', async () => {
            const { video } = await seedLibrary();

            expect(video.url).toMatch(new RegExp(`^${VIDEO_URL_HOST}/`));
            expect(video.thumbUrl).toBe(
                `${video.url}/thumbnails/thumbnail.jpg`
            );
            expect(video.streams).toEqual({
                hls: `${video.url}/manifest/video.m3u8`,
                dash: `${video.url}/manifest/video.mpd`
            });
        });

        it('keeps an SVG on the app’s route under the default MIME gate [media:I-43]', async () => {
            // The provider would publish it; the core does not ask. A CDN
            // serves it without `nosniff`, the CSP or the attachment
            // disposition, so a scripted SVG would run on the CDN's origin.
            const { agent, svg, entry } = await seedLibrary();

            expect(svg.url).toBe(raw(svg.id));
            expect((await listed(agent)).get(svg.id)?.url).toBe(raw(svg.id));
            expect((await resolved(agent, entry)).get(svg.id)?.url).toBe(
                raw(svg.id)
            );
        });

        it('reports public URLs from the token upload route too', async () => {
            const agent = await login();
            const secret = await mintFullToken(agent);

            const asset = await tokenUpload(
                secret,
                await makeImage(),
                'token.png',
                'image/png'
            );

            expect(asset.url).toMatch(new RegExp(`^${PUBLIC_URL_HOST}/`));
            expect(asset.thumbUrl).toMatch(new RegExp(`^${PUBLIC_URL_HOST}/`));
        });

        it('hands the editor’s resolver the same URLs as the library', async () => {
            const { agent, image, video, entry } = await seedLibrary();

            const refs = await resolved(agent, entry);
            expect(refs.get(image.id)).toMatchObject({
                url: image.url,
                thumbUrl: image.thumbUrl,
                previewUrl: image.previewUrl
            });
            expect(refs.get(video.id)).toMatchObject({
                url: video.url,
                thumbUrl: video.thumbUrl
            });
        });

        it('publishes CDN URLs and streams in ?media=preview, and nothing else [media:I-45]', async () => {
            const { agent, image, svg, video, entry } = await seedLibrary();
            const secret = await mintFullToken(agent);

            const items = await expanded(secret, entry);

            expect(items.get(image.id)).toMatchObject({
                url: image.url,
                thumbUrl: image.thumbUrl,
                previewUrl: image.previewUrl
            });
            expect(items.get(video.id)).toMatchObject({
                url: video.url,
                thumbUrl: video.thumbUrl,
                streams: video.streams
            });
            // Not published: the token route, never the admin's session one.
            expect(items.get(svg.id)?.url).toBe(tokenRaw(svg.id));
            expect(items.get(svg.id)).not.toHaveProperty('streams');
        });

        it('leaves the authorized routes serving exactly as before', async () => {
            // Publishing a URL is a statement about where else the bytes are
            // reachable, not a change to who may fetch them here.
            const { agent, image } = await seedLibrary();

            await agent.get(raw(image.id)).expect(200);
            await request(harness.server).get(raw(image.id)).expect(401);
        });
    });

    describe("'provider' with publicUrlTypes: 'all'", () => {
        beforeAll(async () => {
            harness = await createTestApp({
                publicUrls: 'provider',
                publicUrlTypes: 'all'
            });
        });
        afterAll(async () => {
            await closeTestApp(harness);
        });
        beforeEach(seed);

        it('publishes an SVG too, for an operator whose CDN hardens it', async () => {
            const agent = await login();
            const svg = await upload(agent, SVG, 'icon.svg', 'image/svg+xml');

            expect(svg.url).toMatch(new RegExp(`^${PUBLIC_URL_HOST}/`));
        });
    });
});
