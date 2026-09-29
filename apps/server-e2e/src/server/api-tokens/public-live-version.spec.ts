import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedContentGrants,
    seedMembership,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'public-live-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** Shape of one item in the public envelope (only the asserted bits). */
interface PublicItem {
    id: string;
    status?: string;
    publishedAt?: string | null;
    values: Record<string, unknown>;
    relations?: Record<
        string,
        { items: { id: string; values: Record<string, unknown> }[] }
    >;
}

/**
 * The public API serves an entry's **live version**, not its working copy.
 *
 * Saving a published entry — an edit, or a restore of an older version —
 * returns the row to `draft` (the admin's **Modified**) while the previously
 * published version stays `published` in the history. Until the next publish,
 * every public read has to keep answering with that published version: the
 * entry must neither disappear nor leak the unpublished edits, whether it is
 * read by id, listed, searched, filtered, reached through GraphQL, or
 * previewed as another entry's relation target.
 */
describe('Public content API — the live version of a modified entry', () => {
    let harness: TestApp;
    let workspaceId: string;
    let secret: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        const admin = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
        await seedMembership(admin.id, workspaceId);
        await seedContentGrants(workspaceId, [
            'test_article',
            'test_author',
            'test_tag'
        ]);
        const agent = await login();
        secret = (
            await agent
                .post('/api/api-tokens')
                .send({
                    name: 'e2e-live',
                    workspaceIds: [workspaceId],
                    scope: 'full'
                })
                .expect(201)
        ).body.secret as string;
    });

    /** A logged-in admin agent scoped to the workspace. */
    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    function get(path: string, query: Record<string, string> = {}) {
        return request(harness.server)
            .get(`/api/v1/content/${path}`)
            .query(query)
            .set('Authorization', `Bearer ${secret}`);
    }

    /** Creates and publishes an article through the admin API. */
    async function publishedArticle(
        agent: Awaited<ReturnType<typeof login>>,
        text: string,
        extra: Record<string, unknown> = {}
    ): Promise<string> {
        const id = (
            await agent
                .post('/api/content/test_article')
                .send({ values: { text, select: 'article', ...extra } })
                .expect(201)
        ).body.id as string;
        await agent.post(`/api/content/test_article/${id}/publish`).expect(201);
        return id;
    }

    async function edit(
        agent: Awaited<ReturnType<typeof login>>,
        id: string,
        values: Record<string, unknown>
    ) {
        await agent
            .patch(`/api/content/test_article/${id}`)
            .send({ values: { select: 'article', ...values } })
            .expect(200);
    }

    it('keeps serving the published version by id after the entry is edited [content:I-56]', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title', { number: 7 });
        await edit(agent, id, { text: 'Unpublished edit', number: 99 });

        const res = await get(`test_article/${id}`).expect(200);
        const entry = res.body as PublicItem;
        expect(entry.id).toBe(id);
        expect(entry.values['text']).toBe('Live title');
        expect(entry.values['number']).toBe(7);
        // It is the published version being served, so it reads as one.
        expect(entry.status).toBe('published');
        expect(entry.publishedAt).toEqual(expect.any(String));
    });

    it('keeps listing the published version after the entry is edited', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title');
        await publishedArticle(agent, 'Untouched');
        await edit(agent, id, { text: 'Unpublished edit' });

        const res = await get('test_article', { sort: 'text' }).expect(200);
        expect(res.body.total).toBe(2);
        expect(
            (res.body.items as PublicItem[]).map((item) => item.values['text'])
        ).toEqual(['Live title', 'Untouched']);
    });

    it('keeps serving the published version after an older version is restored', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Version one');
        await edit(agent, id, { text: 'Version two' });
        await agent.post(`/api/content/test_article/${id}/publish`).expect(201);

        // Restoring v1 appends v3 — a draft over the live v2.
        await agent
            .post(`/api/content/test_article/${id}/revisions/1/restore`)
            .expect(201);

        const res = await get(`test_article/${id}`).expect(200);
        expect((res.body as PublicItem).values['text']).toBe('Version two');
    });

    it('serves the new content once the draft is published', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title');
        await edit(agent, id, { text: 'Next title' });
        await agent.post(`/api/content/test_article/${id}/publish`).expect(201);

        const res = await get(`test_article/${id}`).expect(200);
        expect((res.body as PublicItem).values['text']).toBe('Next title');
    });

    it('serves an earlier version published over a newer draft', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Version one');
        await edit(agent, id, { text: 'Version two' });

        await agent
            .post(`/api/content/test_article/${id}/revisions/1/publish`)
            .expect(201);

        const res = await get(`test_article/${id}`).expect(200);
        expect((res.body as PublicItem).values['text']).toBe('Version one');
    });

    it('stops serving the entry once it is unpublished', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title');
        await edit(agent, id, { text: 'Unpublished edit' });
        await agent
            .post(`/api/content/test_article/${id}/unpublish`)
            .expect(201);

        await get(`test_article/${id}`).expect(404);
        expect((await get('test_article').expect(200)).body.total).toBe(0);
    });

    it('still hides an entry that was never published', async () => {
        const agent = await login();
        const id = (
            await agent
                .post('/api/content/test_article')
                .send({ values: { text: 'Only a draft', select: 'article' } })
                .expect(201)
        ).body.id as string;
        await edit(agent, id, { text: 'Still a draft' });

        await get(`test_article/${id}`).expect(404);
        expect((await get('test_article').expect(200)).body.total).toBe(0);
    });

    it('searches and filters the published version, never the unpublished edit [content:I-56]', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title');
        await edit(agent, id, { text: 'Secret draft' });

        const byEdit = await get('test_article', {
            filter: JSON.stringify({
                and: [{ field: 'text', op: 'eq', value: 'Secret draft' }]
            })
        }).expect(200);
        expect(byEdit.body.total).toBe(0);
        expect(
            (await get('test_article', { search: 'Secret' }).expect(200)).body
                .total
        ).toBe(0);

        const byLive = await get('test_article', {
            filter: JSON.stringify({
                and: [{ field: 'text', op: 'eq', value: 'Live title' }]
            })
        }).expect(200);
        expect(byLive.body.total).toBe(1);
        expect((byLive.body.items as PublicItem[])[0].id).toBe(id);
        expect(
            (await get('test_article', { search: 'Live' }).expect(200)).body
                .total
        ).toBe(1);
    });

    it('still returns the working copy to a draft read', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title');
        await edit(agent, id, { text: 'Unpublished edit' });

        const res = await get(`test_article/${id}`, {
            status: 'draft'
        }).expect(200);
        expect((res.body as PublicItem).values['text']).toBe(
            'Unpublished edit'
        );
        expect((res.body as PublicItem).status).toBe('draft');
    });

    it('serves the published version over GraphQL', async () => {
        const agent = await login();
        const id = await publishedArticle(agent, 'Live title');
        await edit(agent, id, { text: 'Unpublished edit' });

        const res = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({
                query: 'query Q($id: ID!) { testArticle(id: $id) { id text } testArticles { items { text } total } }',
                variables: { id }
            })
            .expect(200);
        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.testArticle).toEqual({ id, text: 'Live title' });
        expect(res.body.data.testArticles).toEqual({
            items: [{ text: 'Live title' }],
            total: 1
        });
    });

    it('serves the many-to-many links the entry was published with', async () => {
        const agent = await login();
        const tagId = async (name: string) => {
            const tag = (
                await agent
                    .post('/api/content/test_tag')
                    .send({ values: { name } })
                    .expect(201)
            ).body.id as string;
            await agent
                .post(`/api/content/test_tag/${tag}/publish`)
                .expect(201);
            return tag;
        };
        const live = await tagId('Live');
        const draft = await tagId('Draft');
        const id = await publishedArticle(agent, 'Live title', {
            tags: [live]
        });
        await edit(agent, id, { text: 'Live title', tags: [draft] });

        const preview = await get(`test_article/${id}`, {
            relations: 'preview',
            relationFields: 'tags'
        }).expect(200);
        const tags = (preview.body as PublicItem).relations?.['tags'];
        expect(tags?.items.map((item) => item.id)).toEqual([live]);

        const field = await get(`test_article/${id}/relations/tags`).expect(
            200
        );
        expect(field.body.total).toBe(1);
        expect(
            (field.body.items as { id: string }[]).map((item) => item.id)
        ).toEqual([live]);

        // A filter over the relation sees the published links too.
        const byDraftTag = await get('test_article', {
            filter: JSON.stringify({
                and: [{ field: 'tags.name', op: 'eq', value: 'Draft' }]
            })
        }).expect(200);
        expect(byDraftTag.body.total).toBe(0);
    });

    it('keeps a modified relation target visible with its published values', async () => {
        const agent = await login();
        const authorId = (
            await agent
                .post('/api/content/test_author')
                .send({ values: { name: 'Ada' } })
                .expect(201)
        ).body.id as string;
        await agent
            .post(`/api/content/test_author/${authorId}/publish`)
            .expect(201);
        const id = await publishedArticle(agent, 'Live title', {
            author: authorId
        });

        await agent
            .patch(`/api/content/test_author/${authorId}`)
            .send({ values: { name: 'Ada (draft)' } })
            .expect(200);

        const res = await get(`test_article/${id}`, {
            relations: 'preview',
            relationFields: 'author'
        }).expect(200);
        const author = (res.body as PublicItem).relations?.['author'];
        expect(author?.items.map((item) => item.id)).toEqual([authorId]);
        expect(author?.items[0].values['name']).toBe('Ada');

        const field = await get(`test_article/${id}/relations/author`).expect(
            200
        );
        expect(field.body.total).toBe(1);
    });
});
