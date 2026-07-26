import request from 'supertest';
import sharp from 'sharp';
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
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'content-media-admin@example.com';
const PASSWORD = 'SecurePass123!';
const RANDOM_UUID = '11111111-1111-1111-1111-111111111111';

const PNG = Buffer.from('\x89PNG\r\n\x1a\nfake-png-bytes', 'binary');
const PDF = Buffer.from('%PDF-1.4 fake-pdf-bytes', 'binary');

/** Minimal valid `test_article` values (title has minLength 3). */
const BASE = { text: 'Hello world', select: 'article' } as const;

/**
 * Media fields on content records (`test_article.image` / `heroImage` /
 * `attachments`). Covers: storing an asset id and reading it back, the
 * cross-plugin existence + `accept` enforcement (missing / cross-workspace /
 * disallowed kind → 422), multiple ordering, the `/:id/media` resolve endpoint,
 * and capture in the revision snapshot.
 */
describe('Content media fields (/api/content/:type)', () => {
    let harness: TestApp;
    let admin: SeededUser;
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
        admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        const ws = await seedWorkspace({ name: 'WS One', slug: 'ws-one' });
        const other = await seedWorkspace({ name: 'WS Two', slug: 'ws-two' });
        workspaceId = ws.id;
        otherWorkspaceId = other.id;
        await seedMembership(admin.id, workspaceId);
        await seedMembership(admin.id, otherWorkspaceId);
    });

    async function login(workspace = workspaceId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace);
        return agent;
    }

    /** Uploads a file into a workspace and returns the new asset id. */
    async function upload(
        agent: request.Agent,
        bytes: Buffer,
        filename: string,
        contentType: string
    ): Promise<string> {
        const res = await agent
            .post('/api/media/assets')
            .attach('file', bytes, { filename, contentType })
            .expect(201);
        return res.body.id as string;
    }

    // Not `async` — return the supertest `Test` itself so callers can chain
    // `.expect(...)` (an async wrapper would unwrap it to a `Response`).
    function create(agent: request.Agent, values: Record<string, unknown>) {
        return agent
            .post('/api/content/test_article')
            .send({ values: { ...BASE, ...values } });
    }

    it('stores and reads back a single media asset id', async () => {
        const agent = await login();
        const imageId = await upload(agent, PNG, 'cover.png', 'image/png');

        const created = await create(agent, { image: imageId }).expect(201);
        expect(created.body.values.image).toBe(imageId);

        const read = await agent
            .get(`/api/content/test_article/${created.body.id}`)
            .expect(200);
        expect(read.body.values.image).toBe(imageId);
    });

    it('422s a media id that does not exist', async () => {
        const agent = await login();
        const res = await create(agent, { image: RANDOM_UUID }).expect(422);
        expect(res.body.issues).toContainEqual({
            field: 'image',
            message: 'must reference an existing asset'
        });
    });

    it('422s a media asset from another workspace (no cross-workspace leak)', async () => {
        const other = await login(otherWorkspaceId);
        const foreignId = await upload(other, PNG, 'foreign.png', 'image/png');

        const agent = await login();
        const res = await create(agent, { image: foreignId }).expect(422);
        // Same message as a non-existent id — no not-found-vs-forbidden signal.
        expect(res.body.issues).toContainEqual({
            field: 'image',
            message: 'must reference an existing asset'
        });
    });

    it('422s an asset whose kind fails the field accept restriction', async () => {
        const agent = await login();
        const pdfId = await upload(agent, PDF, 'spec.pdf', 'application/pdf');

        const res = await create(agent, { image: pdfId }).expect(422);
        expect(res.body.issues?.[0]?.field).toBe('image');
        expect(res.body.issues?.[0]?.message).toMatch(/must be/);
    });

    it('preserves the order of a multiple media field across an update', async () => {
        const agent = await login();
        const a = await upload(agent, PNG, 'a.png', 'image/png');
        const b = await upload(agent, PNG, 'b.png', 'image/png');
        const c = await upload(agent, PNG, 'c.png', 'image/png');

        const created = await create(agent, {
            attachments: [a, b, c]
        }).expect(201);
        expect(created.body.values.attachments).toEqual([a, b, c]);

        const updated = await agent
            .patch(`/api/content/test_article/${created.body.id}`)
            .send({ values: { ...BASE, attachments: [c, a, b] } })
            .expect(200);
        expect(updated.body.values.attachments).toEqual([c, a, b]);
    });

    it('carries the thumb/preview derivative urls on a resolved ref', async () => {
        const agent = await login();
        // A real, decodable image — the fake PNG the other cases use produces no
        // derivatives, which is exactly the fallback path asserted below.
        const png = await sharp({
            create: {
                width: 900,
                height: 600,
                channels: 3,
                background: { r: 20, g: 120, b: 200 }
            }
        })
            .png()
            .toBuffer();
        const imageId = await upload(agent, png, 'wide.png', 'image/png');
        const docId = await upload(agent, PDF, 'notes.pdf', 'application/pdf');
        const created = await create(agent, {
            image: imageId,
            attachments: [docId]
        }).expect(201);

        const res = await agent
            .get(`/api/content/test_article/${created.body.id}/media`)
            .expect(200);
        // The editor tile renders the derivative, not the original — that is the
        // whole point of resolving refs server-side.
        expect(res.body.media.image[0]).toMatchObject({
            url: `/api/media/assets/${imageId}/raw`,
            thumbUrl: `/api/media/assets/${imageId}/raw?variant=thumb`,
            previewUrl: `/api/media/assets/${imageId}/raw?variant=preview`
        });
        // A non-image has no derivative, so the ref carries none and the tile
        // falls back to the original.
        expect(res.body.media.attachments[0].thumbUrl).toBeUndefined();
    });

    it('resolves media ids to refs via GET /:id/media', async () => {
        const agent = await login();
        const imageId = await upload(agent, PNG, 'cover.png', 'image/png');
        const created = await create(agent, { image: imageId }).expect(201);

        const res = await agent
            .get(`/api/content/test_article/${created.body.id}/media`)
            .expect(200);
        expect(res.body.media.image).toHaveLength(1);
        expect(res.body.media.image[0]).toMatchObject({
            id: imageId,
            name: 'cover.png',
            kind: 'image',
            url: `/api/media/assets/${imageId}/raw`
        });
    });

    it('captures media ids in the revision snapshot', async () => {
        const agent = await login();
        const imageId = await upload(agent, PNG, 'cover.png', 'image/png');
        const a = await upload(agent, PNG, 'a.png', 'image/png');
        const b = await upload(agent, PNG, 'b.png', 'image/png');
        const created = await create(agent, {
            image: imageId,
            attachments: [a, b]
        }).expect(201);

        const detail = await agent
            .get(`/api/content/test_article/${created.body.id}/revisions/1`)
            .expect(200);
        expect(detail.body.snapshot.values.image).toBe(imageId);
        expect(detail.body.snapshot.values.attachments).toEqual([a, b]);
        // Enriched with resolved media refs, not raw uuids — the admin's version
        // preview renders the **name** and the thumbnail `url` from these, so
        // they're part of the contract, not just the id.
        expect(detail.body.mediaRefs.image[0]).toMatchObject({
            id: imageId,
            name: 'cover.png',
            kind: 'image',
            url: `/api/media/assets/${imageId}/raw`
        });
        // A `multiple` field resolves its whole list, in stored order.
        expect(
            (detail.body.mediaRefs.attachments as { name: string }[]).map(
                (ref) => ref.name
            )
        ).toEqual(['a.png', 'b.png']);
    });
});
