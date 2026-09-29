import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    archiveWorkspace,
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedAllSharedContentGrants,
    seedArticleTags,
    seedArticles,
    seedAuthors,
    seedMembership,
    seedTags,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'shared-ws-admin@example.com';
const PASSWORD = 'SecurePass123!';

const VALID = { text: 'Consumer article', select: 'article' } as const;

/** The `source` a record carries across the workspace boundary. */
interface Source {
    workspaceId: string;
    workspaceName: string;
}

/** One linked record on an admin relation read. */
interface RelationRef {
    id: string;
    title: string;
    missing?: boolean;
    source?: Source | null;
}

/** Published-now columns for a seeded row. */
const PUBLISHED = { status: 'published', publishedAt: new Date() } as const;

/**
 * **Shared workspaces** (ADR-0019) on the session API.
 *
 * A workspace flagged shared exposes its published, live entries — read-only —
 * to every other workspace granted the same type. The suite pins the rule from
 * both sides: what a consumer may now read and link (and the `source` /
 * `readOnly` it is told), and everything that must still be refused — drafts,
 * non-shared and archived workspaces, a missing grant, and every write path on
 * a foreign id. It also covers the cross-workspace usage count the shared side
 * reads before it unpublishes something.
 *
 * Seeded content goes in directly (the seeders stamp `workspace_id`); every
 * assertion goes through the HTTP API.
 */
describe('Shared workspaces (content, session API)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    /** The consumer — the workspace the requests act in. */
    let consumerId: string;
    /** The shared workspace. */
    let sharedId: string;
    /** A workspace that is NOT shared. */
    let privateId: string;
    /** Published tag in the shared workspace. */
    let sharedTag: string;
    /** Draft tag in the shared workspace. */
    let sharedDraftTag: string;
    /** Published tag in the non-shared workspace. */
    let privateTag: string;
    /** The consumer's own tag. */
    let ownTag: string;
    /** Published author in the shared workspace. */
    let sharedAuthor: string;

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
        consumerId = (
            await seedWorkspace({ name: 'Consumer', slug: 'consumer' })
        ).id;
        sharedId = (
            await seedWorkspace({
                name: 'Brand library',
                slug: 'brand-library',
                isShared: true
            })
        ).id;
        privateId = (await seedWorkspace({ name: 'Private', slug: 'private' }))
            .id;
        for (const id of [consumerId, sharedId, privateId]) {
            await seedMembership(admin.id, id);
            await seedAllContentGrants(id);
        }
        // Explicit per-source grants (ADR-0019): the consumer reads the shared
        // workspace's records through shared grants of every type — and holds
        // the same grants of the private workspace, which stay inert because it
        // is not shared.
        await seedAllSharedContentGrants(consumerId, sharedId);
        await seedAllSharedContentGrants(consumerId, privateId);
        [sharedTag, sharedDraftTag] = await seedTags(
            [{ name: 'Shared Design', ...PUBLISHED }, { name: 'Shared Draft' }],
            sharedId
        );
        [privateTag] = await seedTags(
            [{ name: 'Private Design', ...PUBLISHED }],
            privateId
        );
        [ownTag] = await seedTags(
            [{ name: 'Own Design', ...PUBLISHED }],
            consumerId
        );
        [sharedAuthor] = await seedAuthors(
            [{ name: 'Shared Ada', ...PUBLISHED }],
            sharedId
        );
    });

    /** A logged-in agent acting in `workspaceId` (the consumer by default). */
    async function login(workspaceId = consumerId) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    /** Creates a consumer article and returns its id. */
    async function createArticle(
        agent: request.Agent,
        body: Record<string, unknown> = {}
    ): Promise<string> {
        const res = await agent
            .post('/api/content/test_article')
            .send({ values: VALID, ...body })
            .expect(201);
        return res.body.id as string;
    }

    /** The first page of an article's `tags` on the admin relation read. */
    async function tagsOf(
        agent: request.Agent,
        articleId: string
    ): Promise<{ items: RelationRef[]; total: number }> {
        const res = await agent
            .get(`/api/content/test_article/${articleId}/relations`)
            .expect(200);
        return res.body.relations.tags;
    }

    /** Removes one content grant out of band (the API refuses while entries exist). */
    async function revokeGrant(workspaceId: string, slug: string) {
        await getPool().query(
            'DELETE FROM workspace_content WHERE workspace_id = $1 AND slug = $2',
            [workspaceId, slug]
        );
    }

    describe('linking', () => {
        it('links a published entry of a shared workspace and reads it back with its source [content:I-43]', async () => {
            const agent = await login();
            const articleId = await createArticle(agent, {
                values: { ...VALID, author: sharedAuthor },
                relations: { tags: { link: [ownTag, sharedTag] } }
            });

            const tags = await tagsOf(agent, articleId);
            expect(tags.total).toBe(2);
            const byId = new Map(tags.items.map((ref) => [ref.id, ref]));
            expect(byId.get(ownTag)).toMatchObject({
                title: 'Own Design',
                source: null
            });
            expect(byId.get(sharedTag)).toMatchObject({
                title: 'Shared Design',
                source: {
                    workspaceId: sharedId,
                    workspaceName: 'Brand library'
                }
            });
            expect(byId.get(sharedTag)?.missing).toBeUndefined();

            const author = await agent
                .get(`/api/content/test_article/${articleId}/relations/author`)
                .expect(200);
            expect(author.body).toMatchObject({
                total: 1,
                items: [
                    {
                        id: sharedAuthor,
                        title: 'Shared Ada',
                        source: { workspaceId: sharedId }
                    }
                ]
            });
        });

        it.each([
            ['a draft of the shared workspace', () => sharedDraftTag],
            ['an entry of a non-shared workspace', () => privateTag]
        ])(
            '422s a link to %s, like a missing id [content:I-43]',
            async (_label, target) => {
                const agent = await login();
                const res = await agent
                    .post('/api/content/test_article')
                    .send({
                        values: VALID,
                        relations: { tags: { link: [target()] } }
                    })
                    .expect(422);
                expect(res.body.issues).toEqual([
                    {
                        field: 'tags',
                        message: 'must reference an existing entry'
                    }
                ]);
            }
        );

        it('422s a link when the consumer lacks the target type grant [content:I-43]', async () => {
            await revokeGrant(consumerId, 'test_tag');
            const agent = await login();
            await agent
                .post('/api/content/test_article')
                .send({
                    values: VALID,
                    relations: { tags: { link: [sharedTag] } }
                })
                .expect(422);
        });

        it('422s a link into an archived shared workspace [workspaces:I-36]', async () => {
            await archiveWorkspace(sharedId);
            const agent = await login();
            await agent
                .post('/api/content/test_article')
                .send({ values: { ...VALID, author: sharedAuthor } })
                .expect(422);
        });

        it('refuses the inverse side — linking a foreign record there would write its relation [content:I-42]', async () => {
            const [sharedArticle] = await seedArticles(
                [{ text: 'Shared article', select: 'article', ...PUBLISHED }],
                sharedId
            );
            const agent = await login();
            await agent
                .patch(`/api/content/test_tag/${ownTag}`)
                .send({
                    values: { name: 'Own Design' },
                    relations: { articles: { link: [sharedArticle] } }
                })
                .expect(422);
        });
    });

    describe('read-only', () => {
        it('404s every write on a foreign id from the consumer [content:I-42]', async () => {
            const agent = await login();
            await agent
                .patch(`/api/content/test_tag/${sharedTag}`)
                .send({ values: { name: 'Hijacked' } })
                .expect(404);
            await agent
                .post(`/api/content/test_tag/${sharedTag}/unpublish`)
                .expect(404);
            await agent
                .delete(`/api/content/test_tag/${sharedTag}`)
                .expect(404);
            await agent
                .post('/api/content/test_tag/bulk/delete')
                .send({ ids: [sharedTag] })
                .expect(200);

            // Nothing moved on the shared side.
            const { rows } = await getPool().query(
                'SELECT name, status, deleted_at FROM content_test_tag WHERE id = $1',
                [sharedTag]
            );
            expect(rows[0]).toMatchObject({
                name: 'Shared Design',
                status: 'published',
                deleted_at: null
            });
        });

        it('reads a visible foreign entry with source and readOnly [content:I-41]', async () => {
            const agent = await login();
            const res = await agent
                .get(`/api/content/test_tag/${sharedTag}`)
                .expect(200);
            expect(res.body).toMatchObject({
                id: sharedTag,
                readOnly: true,
                source: {
                    workspaceId: sharedId,
                    workspaceName: 'Brand library'
                },
                values: { name: 'Shared Design' }
            });
            expect(res.body.workspaceId).toBeUndefined();

            const own = await agent
                .get(`/api/content/test_tag/${ownTag}`)
                .expect(200);
            expect(own.body).toMatchObject({ readOnly: false, source: null });
        });

        it('404s a foreign draft and an entry of a non-shared workspace [content:I-41]', async () => {
            const agent = await login();
            await agent
                .get(`/api/content/test_tag/${sharedDraftTag}`)
                .expect(404);
            await agent.get(`/api/content/test_tag/${privateTag}`).expect(404);
        });

        it("reads a foreign entry's own links — visible targets only — and still 404s writes to it [content:I-41]", async () => {
            // A published library article linking one published and one draft
            // library tag, plus the library's published author.
            const [sharedArticle] = await seedArticles(
                [
                    {
                        text: 'Library article',
                        select: 'article',
                        author: sharedAuthor,
                        ...PUBLISHED
                    }
                ],
                sharedId
            );
            await seedArticleTags(sharedArticle, [sharedTag, sharedDraftTag]);

            const agent = await login();
            const all = await agent
                .get(`/api/content/test_article/${sharedArticle}/relations`)
                .expect(200);
            expect(all.body.relations.tags).toEqual({
                total: 1,
                items: [
                    expect.objectContaining({
                        id: sharedTag,
                        title: 'Shared Design',
                        source: {
                            workspaceId: sharedId,
                            workspaceName: 'Brand library'
                        }
                    })
                ]
            });
            expect(all.body.relations.author).toMatchObject({
                total: 1,
                items: [{ id: sharedAuthor, source: { workspaceId: sharedId } }]
            });

            const page = await agent
                .get(
                    `/api/content/test_article/${sharedArticle}/relations/tags`
                )
                .query({ page: 1, pageSize: 10 })
                .expect(200);
            expect(page.body.total).toBe(1);
            expect(page.body.items.map((ref: RelationRef) => ref.id)).toEqual([
                sharedTag
            ]);

            // Reading is all it is: a relation write on the foreign entry is
            // a 404, like any other write on it.
            await agent
                .patch(`/api/content/test_article/${sharedArticle}`)
                .send({
                    values: VALID,
                    relations: { tags: { unlink: [sharedTag] } }
                })
                .expect(404);

            // A foreign draft's relations stay as invisible as the draft.
            const [draftArticle] = await seedArticles(
                [{ text: 'Library draft', select: 'article' }],
                sharedId
            );
            await agent
                .get(`/api/content/test_article/${draftArticle}/relations`)
                .expect(404);
        });
    });

    describe('GET /api/content/:typeName?source=', () => {
        /** Lists tags in the consumer with the given query. */
        async function listTags(query: Record<string, string | number>) {
            const agent = await login();
            const res = await agent
                .get('/api/content/test_tag')
                .query({ sort: 'name', ...query })
                .expect(200);
            return res.body as {
                items: { id: string; source: Source | null }[];
                total: number;
            };
        }

        it('defaults to own, and every item carries source: null [content:I-45]', async () => {
            const page = await listTags({});
            expect(page.items.map((item) => item.id)).toEqual([ownTag]);
            expect(page.items[0].source).toBeNull();
        });

        it('lists only visible shared entries with source=shared [content:I-45]', async () => {
            const page = await listTags({ source: 'shared' });
            expect(page.total).toBe(1);
            expect(page.items).toEqual([
                expect.objectContaining({
                    id: sharedTag,
                    source: {
                        workspaceId: sharedId,
                        workspaceName: 'Brand library'
                    }
                })
            ]);
        });

        it('unions own and shared with source=all, searching and paging across both [content:I-45]', async () => {
            const all = await listTags({ source: 'all' });
            expect(all.total).toBe(2);
            expect(all.items.map((item) => item.id)).toEqual([
                ownTag,
                sharedTag
            ]);

            const searched = await listTags({
                source: 'all',
                search: 'Shared'
            });
            expect(searched.items.map((item) => item.id)).toEqual([sharedTag]);

            const second = await listTags({
                source: 'all',
                page: 2,
                pageSize: 1
            });
            expect(second.total).toBe(2);
            expect(second.items.map((item) => item.id)).toEqual([sharedTag]);
        });

        it('shows nothing shared once the workspace is archived [workspaces:I-36]', async () => {
            await archiveWorkspace(sharedId);
            expect((await listTags({ source: 'shared' })).total).toBe(0);
        });

        it('400s an unknown source', async () => {
            const agent = await login();
            await agent
                .get('/api/content/test_tag')
                .query({ source: 'everything' })
                .expect(400);
        });
    });

    describe('visibility changes', () => {
        it('hides a link whose shared target is unpublished, keeping the row [content:I-44]', async () => {
            const consumer = await login();
            const articleId = await createArticle(consumer, {
                values: { ...VALID, author: sharedAuthor },
                relations: { tags: { link: [sharedTag] } }
            });
            expect((await tagsOf(consumer, articleId)).total).toBe(1);

            // The shared side unpublishes through its own API.
            const owner = await login(sharedId);
            await owner
                .post(`/api/content/test_tag/${sharedTag}/unpublish`)
                .expect(201);
            await owner
                .post(`/api/content/test_author/${sharedAuthor}/unpublish`)
                .expect(201);

            expect(await tagsOf(consumer, articleId)).toEqual({
                items: [],
                total: 0
            });
            const author = await consumer
                .get(`/api/content/test_article/${articleId}/relations/author`)
                .expect(200);
            expect(author.body).toEqual({ items: [], total: 0 });

            const { rows } = await getPool().query(
                'SELECT count(*)::int AS n FROM content_test_article_tags WHERE source_id = $1',
                [articleId]
            );
            expect(rows[0].n).toBe(1);

            // The consumer's own entry stays saveable with the hidden FK in it.
            await consumer
                .patch(`/api/content/test_article/${articleId}`)
                .send({
                    values: {
                        ...VALID,
                        text: 'Still editable',
                        author: sharedAuthor
                    }
                })
                .expect(200);
        });

        it('hides the link when the workspace stops being shared [content:I-44]', async () => {
            const consumer = await login();
            const articleId = await createArticle(consumer, {
                relations: { tags: { link: [sharedTag] } }
            });
            await consumer
                .patch(`/api/workspaces/${sharedId}`)
                .send({ isShared: false })
                .expect(200);
            expect((await tagsOf(consumer, articleId)).total).toBe(0);
        });
    });

    describe('GET /api/content/:typeName/:id/usages', () => {
        it('counts links from other workspaces, grouped and sorted by count [content:I-46]', async () => {
            const secondId = (
                await seedWorkspace({ name: 'Second consumer', slug: 'second' })
            ).id;
            await seedMembership(admin.id, secondId);
            await seedAllContentGrants(secondId);
            await seedAllSharedContentGrants(secondId, sharedId);

            const [a1, a2] = await seedArticles(
                [
                    { text: 'One', select: 'article' },
                    { text: 'Two', select: 'article' }
                ],
                consumerId
            );
            await seedArticleTags(a1, [sharedTag]);
            await seedArticleTags(a2, [sharedTag]);
            const [b1] = await seedArticles(
                [{ text: 'Three', select: 'article' }],
                secondId
            );
            await seedArticleTags(b1, [sharedTag]);
            // A link from inside the shared workspace itself is not a usage.
            const [inside] = await seedArticles(
                [{ text: 'Inside', select: 'article' }],
                sharedId
            );
            await seedArticleTags(inside, [sharedTag]);

            const owner = await login(sharedId);
            const res = await owner
                .get(`/api/content/test_tag/${sharedTag}/usages`)
                .expect(200);
            expect(res.body).toEqual({
                items: [
                    {
                        workspaceId: consumerId,
                        workspaceName: 'Consumer',
                        count: 2
                    },
                    {
                        workspaceId: secondId,
                        workspaceName: 'Second consumer',
                        count: 1
                    }
                ]
            });
        });

        it('counts owning single-relation links too', async () => {
            await seedArticles(
                [{ text: 'By Ada', select: 'article', author: sharedAuthor }],
                consumerId
            );
            const owner = await login(sharedId);
            const res = await owner
                .get(`/api/content/test_author/${sharedAuthor}/usages`)
                .expect(200);
            expect(res.body.items).toEqual([
                expect.objectContaining({ workspaceId: consumerId, count: 1 })
            ]);
        });

        it('answers empty items when nothing links to the entry', async () => {
            const owner = await login(sharedId);
            const res = await owner
                .get(`/api/content/test_tag/${sharedTag}/usages`)
                .expect(200);
            expect(res.body).toEqual({ items: [] });
        });

        it('404s from a consumer — the entry must belong to the caller [content:I-46]', async () => {
            const consumer = await login();
            await consumer
                .get(`/api/content/test_tag/${sharedTag}/usages`)
                .expect(404);
        });

        it('401s without a session', async () => {
            await request(harness.server)
                .get(`/api/content/test_tag/${sharedTag}/usages`)
                .set('X-Workspace-Id', sharedId)
                .expect(401);
        });
    });
});
