import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'revisions-admin@example.com';
const PASSWORD = 'SecurePass123!';

const VALID = { text: 'First title', select: 'article' } as const;

/**
 * The entry revision history (`GET /api/content/:type/:id/revisions[/:number]`
 * and `.../restore`). Every save appends an immutable snapshot; restore
 * re-applies an earlier one as a **new** revision (append-only history). Covers
 * the numbering, the newest-first timeline, the snapshot body (scalars + a
 * many-to-many link set), restore, and the workspace/permission scoping.
 */
describe('Content entry revisions (/api/content/:type/:id/revisions)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;

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
        workspaceId = ws.id;
        await seedMembership(admin.id, workspaceId);
        await seedAllContentGrants(workspaceId);
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    it('records a revision on create, keyed to the acting user', async () => {
        const agent = await login(ADMIN_EMAIL);
        const create = await agent
            .post('/api/content/test_article')
            .send({ values: VALID })
            .expect(201);
        const id = create.body.id as string;

        const list = await agent
            .get(`/api/content/test_article/${id}/revisions`)
            .expect(200);
        expect(list.body.total).toBe(1);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0]).toMatchObject({
            number: 1,
            status: 'draft',
            isLatest: true,
            authorId: admin.id
        });
    });

    it('appends an incrementing revision on every save, newest first', async () => {
        const agent = await login(ADMIN_EMAIL);
        const create = await agent
            .post('/api/content/test_article')
            .send({ values: VALID })
            .expect(201);
        const id = create.body.id as string;

        await agent
            .patch(`/api/content/test_article/${id}`)
            .send({ values: { ...VALID, text: 'Second title' } })
            .expect(200);

        const list = await agent
            .get(`/api/content/test_article/${id}/revisions`)
            .expect(200);
        expect(list.body.total).toBe(2);
        // Newest first: v2 is latest, v1 is not.
        expect(
            list.body.items.map((r: { number: number }) => r.number)
        ).toEqual([2, 1]);
        expect(list.body.items[0]).toMatchObject({ number: 2, isLatest: true });
        expect(list.body.items[1]).toMatchObject({
            number: 1,
            isLatest: false
        });
    });

    it('captures the whole document — scalars and a many-to-many link set', async () => {
        const agent = await login(ADMIN_EMAIL);
        const tag = await agent
            .post('/api/content/test_tag')
            .send({ values: { name: 'News' } })
            .expect(201);
        const tagId = tag.body.id as string;

        const create = await agent
            .post('/api/content/test_article')
            .send({ values: { ...VALID, tags: [tagId] } })
            .expect(201);
        const id = create.body.id as string;

        const detail = await agent
            .get(`/api/content/test_article/${id}/revisions/1`)
            .expect(200);
        expect(detail.body.snapshot.values).toMatchObject({
            text: 'First title',
            select: 'article'
        });
        expect(detail.body.snapshot.relations.tags).toEqual([tagId]);
    });

    it('resolves relation snapshot ids to titled records in the detail', async () => {
        const agent = await login(ADMIN_EMAIL);
        const tag = await agent
            .post('/api/content/test_tag')
            .send({ values: { name: 'News' } })
            .expect(201);
        const tagId = tag.body.id as string;

        const create = await agent
            .post('/api/content/test_article')
            .send({ values: { ...VALID, tags: [tagId] } })
            .expect(201);
        const id = create.body.id as string;

        const detail = await agent
            .get(`/api/content/test_article/${id}/revisions/1`)
            .expect(200);
        // The preview lists the actual linked record, not the raw uuid.
        expect(detail.body.relationTotals.tags).toBe(1);
        expect(detail.body.relationRefs.tags).toEqual([
            expect.objectContaining({ id: tagId, title: 'News' })
        ]);
    });

    it('restores an earlier revision as a new revision (append-only)', async () => {
        const agent = await login(ADMIN_EMAIL);
        const create = await agent
            .post('/api/content/test_article')
            .send({ values: VALID })
            .expect(201);
        const id = create.body.id as string;

        await agent
            .patch(`/api/content/test_article/${id}`)
            .send({ values: { ...VALID, text: 'Second title' } })
            .expect(200);

        // Restore v1 — the record's text returns, and a v3 is appended.
        const restore = await agent
            .post(`/api/content/test_article/${id}/revisions/1/restore`)
            .expect(201);
        expect(restore.body.values.text).toBe('First title');

        const list = await agent
            .get(`/api/content/test_article/${id}/revisions`)
            .expect(200);
        expect(list.body.total).toBe(3);
        expect(list.body.items[0]).toMatchObject({ number: 3, isLatest: true });

        const restored = await agent
            .get(`/api/content/test_article/${id}/revisions/3`)
            .expect(200);
        expect(restored.body.snapshot.values.text).toBe('First title');
    });

    it('404s an unknown revision number', async () => {
        const agent = await login(ADMIN_EMAIL);
        const create = await agent
            .post('/api/content/test_article')
            .send({ values: VALID })
            .expect(201);
        const id = create.body.id as string;

        await agent
            .get(`/api/content/test_article/${id}/revisions/999`)
            .expect(404);
    });

    describe('publish transitions', () => {
        it('promotes the latest revision to published on publish', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            await agent
                .post(`/api/content/test_article/${id}/publish`)
                .expect(201);

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            expect(list.body.items[0]).toMatchObject({
                number: 1,
                status: 'published',
                isPublished: true,
                isLatest: true
            });
            expect(list.body.items[0].publishedAt).toEqual(expect.any(String));
        });

        it('supersedes the previously-published revision when a newer one publishes', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            // v1 published, then a fresh save (v2 draft) over the live row.
            await agent
                .post(`/api/content/test_article/${id}/publish`)
                .expect(201);
            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({ values: { ...VALID, text: 'Second title' } })
                .expect(200);
            // Publishing again promotes v2 and supersedes v1.
            await agent
                .post(`/api/content/test_article/${id}/publish`)
                .expect(201);

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            const byNumber = Object.fromEntries(
                list.body.items.map((r: { number: number }) => [r.number, r])
            );
            expect(byNumber[2]).toMatchObject({
                status: 'published',
                isPublished: true,
                isLatest: true
            });
            expect(byNumber[1]).toMatchObject({
                status: 'superseded',
                isPublished: false
            });
        });

        it('reverts the published revision to draft on unpublish', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            await agent
                .post(`/api/content/test_article/${id}/publish`)
                .expect(201);
            await agent
                .post(`/api/content/test_article/${id}/unpublish`)
                .expect(201);

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            expect(list.body.items[0]).toMatchObject({
                number: 1,
                status: 'draft',
                isPublished: false
            });
            expect(list.body.items[0].publishedAt).toBeUndefined();
        });

        it('promotes the revision through a bulk publish too', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            // The bulk routes all carry `@HttpCode(OK)` — 200, not @Post's 201.
            await agent
                .post('/api/content/test_article/bulk/publish')
                .send({ ids: [id] })
                .expect(200);

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            expect(list.body.items[0]).toMatchObject({
                number: 1,
                status: 'published',
                isPublished: true
            });
        });

        it('keeps the published version live when a newer draft is saved', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            // Publish v1, then edit + save → v2 draft. The entry moves to draft,
            // but v1 stays the live version in history.
            await agent
                .post(`/api/content/test_article/${id}/publish`)
                .expect(201);
            const edited = await agent
                .patch(`/api/content/test_article/${id}`)
                .send({ values: { ...VALID, text: 'Second title' } })
                .expect(200);
            expect(edited.body.status).toBe('draft');

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            const byNumber = Object.fromEntries(
                list.body.items.map((r: { number: number }) => [r.number, r])
            );
            expect(byNumber[1]).toMatchObject({
                status: 'published',
                isPublished: true
            });
            expect(byNumber[2]).toMatchObject({
                status: 'draft',
                isLatest: true
            });
        });

        it('publishes a specific earlier version, making it live', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: { ...VALID, text: 'First title' } })
                .expect(201);
            const id = create.body.id as string;

            // v1 published, then two more draft saves (v2, v3).
            await agent
                .post(`/api/content/test_article/${id}/publish`)
                .expect(201);
            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({ values: { ...VALID, text: 'Second title' } })
                .expect(200);
            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({ values: { ...VALID, text: 'Third title' } })
                .expect(200);

            // Publish v1 (an earlier version): its content is re-applied to the
            // live row and **v1 itself** is marked live.
            const published = await agent
                .post(`/api/content/test_article/${id}/revisions/1/publish`)
                .expect(201);
            expect(published.body.status).toBe('published');
            expect(published.body.values.text).toBe('First title');

            const read = await agent
                .get(`/api/content/test_article/${id}`)
                .expect(200);
            expect(read.body.values.text).toBe('First title');

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            const byNumber = Object.fromEntries(
                list.body.items.map((r: { number: number }) => [r.number, r])
            );
            // v1 is live **in place** — publishing a version marks that version
            // published, it does not mint a copy of it.
            expect(byNumber[1]).toMatchObject({
                status: 'published',
                isPublished: true,
                isLatest: false
            });
            // v3 is still the newest; publishing an earlier version means the
            // latest is no longer the live content.
            expect(byNumber[3]).toMatchObject({
                isLatest: true,
                isPublished: false
            });
            // No fourth version was appended.
            expect(list.body.total).toBe(3);
        });

        it('publishes the newest version in place', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            await agent
                .patch(`/api/content/test_article/${id}`)
                .send({ values: { ...VALID, text: 'Second title' } })
                .expect(200);

            await agent
                .post(`/api/content/test_article/${id}/revisions/2/publish`)
                .expect(201);

            const list = await agent
                .get(`/api/content/test_article/${id}/revisions`)
                .expect(200);
            expect(list.body.total).toBe(2);
            expect(list.body.items[0]).toMatchObject({
                number: 2,
                isLatest: true,
                status: 'published'
            });
        });

        it('404s publishing an unknown version', async () => {
            const agent = await login(ADMIN_EMAIL);
            const create = await agent
                .post('/api/content/test_article')
                .send({ values: VALID })
                .expect(201);
            const id = create.body.id as string;

            await agent
                .post(`/api/content/test_article/${id}/revisions/999/publish`)
                .expect(404);
        });
    });
});
