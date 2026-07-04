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
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'content-write-admin@example.com';
const CONTRIB_EMAIL = 'content-write-contrib@example.com';
const VIEWER_EMAIL = 'content-write-viewer@example.com';
const PASSWORD = 'SecurePass123!';

const VALID = { text: 'Hello world', select: 'article' } as const;

/**
 * The entry write API (`POST/PATCH/DELETE /api/content/:type…`, publish/restore,
 * and the bulk routes). Covers the create→read→update→publish→delete→restore→
 * purge lifecycle, the 422 validation shape, the publish-on-non-publishable 400,
 * the `/bulk/...` vs `:id` routing order, the trash list, and the permission
 * matrix (viewer read-only, contributor can't delete).
 */
describe('Content entry writes (/api/content/:type)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    // The workspace under test — stamped onto every write via the agent's
    // default `X-Workspace-Id` header (see `login`).
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
    });

    /**
     * Log in and return an agent carrying both the session cookie and the
     * `X-Workspace-Id` header on every request (`agent.set` registers a default
     * applied to all requests), so entry writes/reads are scoped to the
     * workspace under test.
     */
    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function createArticle(
        agent: request.Agent,
        values: Record<string, unknown> = VALID
    ): Promise<string> {
        const res = await agent
            .post('/api/content/article')
            .send({ values })
            .expect(201);
        return res.body.id as string;
    }

    describe('create / read / update', () => {
        it('creates a draft, reads it back, and updates it', async () => {
            const agent = await login(ADMIN_EMAIL);

            const create = await agent
                .post('/api/content/article')
                .send({ values: VALID })
                .expect(201);
            expect(create.body).toMatchObject({
                status: 'draft',
                values: { text: 'Hello world', select: 'article' }
            });
            const id = create.body.id as string;

            const read = await agent
                .get(`/api/content/article/${id}`)
                .expect(200);
            expect(read.body.id).toBe(id);

            const update = await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: { ...VALID, text: 'Edited title' } })
                .expect(200);
            expect(update.body.values.text).toBe('Edited title');
        });

        it('saves an incomplete draft of a publishable type, but 422s on publish', async () => {
            const agent = await login(ADMIN_EMAIL);
            // A publishable type's draft may be incomplete — create doesn't validate.
            const create = await agent
                .post('/api/content/article')
                .send({ values: { text: 'ab' } })
                .expect(201);
            expect(create.body.status).toBe('draft');

            // Publishing re-validates the stored row and reports per-field issues.
            const res = await agent
                .post(`/api/content/article/${create.body.id}/publish`)
                .expect(422);
            const fields = (res.body.issues as { field: string }[]).map(
                (issue) => issue.field
            );
            // `text` too short and required `select` missing.
            expect(fields).toEqual(expect.arrayContaining(['text', 'select']));
        });

        it('allows editing a draft to an incomplete state, but not a published row', async () => {
            const agent = await login(ADMIN_EMAIL);

            // A draft may be edited to an incomplete (invalid) state.
            const draftId = await createArticle(agent);
            await agent
                .patch(`/api/content/article/${draftId}`)
                .send({ values: { text: '' } })
                .expect(200);

            // A published row must stay valid — clearing a required field 422s.
            const publishedId = await createArticle(agent);
            await agent
                .post(`/api/content/article/${publishedId}/publish`)
                .expect(201);
            await agent
                .patch(`/api/content/article/${publishedId}`)
                .send({ values: { text: '', select: 'article' } })
                .expect(422);
        });

        it('422s an invalid create of a non-publishable (always-live) type', async () => {
            const agent = await login(ADMIN_EMAIL);
            // `landing` is a single, not publishable → its writes validate now.
            const res = await agent
                .post('/api/content/landing')
                .send({ values: { text: 'ab' } })
                .expect(422);
            expect(Array.isArray(res.body.issues)).toBe(true);
            expect(res.body.issues.length).toBeGreaterThan(0);
        });

        it('404s reading an unknown id', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get('/api/content/article/00000000-0000-4000-8000-000000000000')
                .expect(404);
        });
    });

    describe('workspace-scoped relations', () => {
        /** Create an author in `ws` (as a member of it) and return its id. */
        async function seedAuthorIn(ws: string, name: string): Promise<string> {
            // The base workspace already has the admin as a member (beforeEach);
            // only a *different* workspace needs the membership seeded.
            if (ws !== workspaceId) await seedMembership(admin.id, ws);
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);
            agent.set('X-Workspace-Id', ws);
            const res = await agent
                .post('/api/content/author')
                .send({ values: { name } })
                .expect(201);
            return res.body.id as string;
        }

        it('accepts a single relation whose target is in the same workspace', async () => {
            const localAuthor = await seedAuthorIn(workspaceId, 'Local Ada');
            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .post('/api/content/article')
                .send({ values: { ...VALID, author: localAuthor } })
                .expect(201);
            expect(res.body.values.author).toBe(localAuthor);
        });

        it('422s a single relation whose target lives in another workspace', async () => {
            // An author that exists, but in a workspace the caller can't reach —
            // referencing it would be a cross-tenant link and an existence oracle.
            const other = await seedWorkspace({
                name: 'WS Two',
                slug: 'ws-two'
            });
            const foreignAuthor = await seedAuthorIn(other.id, 'Foreign Grace');

            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .post('/api/content/article')
                .send({ values: { ...VALID, author: foreignAuthor } })
                .expect(422);
            const fields = (res.body.issues as { field: string }[]).map(
                (issue) => issue.field
            );
            expect(fields).toContain('author');
        });

        it('422s a single relation pointing at a non-existent id', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post('/api/content/article')
                .send({
                    values: {
                        ...VALID,
                        author: '00000000-0000-4000-8000-000000000000'
                    }
                })
                .expect(422);
        });
    });

    describe('join-backed relations (many-to-many + inverse)', () => {
        /** Create a tag in `ws` (as a member of it) and return its id. */
        async function seedTagIn(ws: string, name: string): Promise<string> {
            if (ws !== workspaceId) await seedMembership(admin.id, ws);
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);
            agent.set('X-Workspace-Id', ws);
            const res = await agent
                .post('/api/content/tag')
                .send({ values: { name } })
                .expect(201);
            return res.body.id as string;
        }

        /** The ordered linked ids for a field on `/…/:id/relations` (first page). */
        async function linkedIds(
            agent: request.Agent,
            type: string,
            id: string,
            field: string
        ): Promise<string[]> {
            const res = await agent
                .get(`/api/content/${type}/${id}/relations`)
                .expect(200);
            const view = (res.body.relations[field] ?? { items: [] }) as {
                items: { id: string }[];
            };
            return view.items.map((ref) => ref.id);
        }

        it('persists a many-to-many on create and reads it back with titles', async () => {
            const agent = await login(ADMIN_EMAIL);
            const eng = await seedTagIn(workspaceId, 'engineering');
            const design = await seedTagIn(workspaceId, 'design');

            const id = await createArticle(agent, {
                ...VALID,
                tags: [eng, design]
            });

            const res = await agent
                .get(`/api/content/article/${id}/relations`)
                .expect(200);
            const tags = res.body.relations.tags as {
                items: { id: string; title: string }[];
                total: number;
            };
            expect(tags.total).toBe(2);
            expect(tags.items.map((t) => t.id).sort()).toEqual(
                [eng, design].sort()
            );
            // Titles are resolved server-side (the tag's `name`).
            expect(tags.items.map((t) => t.title).sort()).toEqual(
                ['design', 'engineering'].sort()
            );
        });

        it('replaces the link set on update (unlink + link in one save)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const eng = await seedTagIn(workspaceId, 'engineering');
            const design = await seedTagIn(workspaceId, 'design');
            const id = await createArticle(agent, {
                ...VALID,
                tags: [eng, design]
            });

            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: { ...VALID, tags: [design] } })
                .expect(200);
            expect(await linkedIds(agent, 'article', id, 'tags')).toEqual([
                design
            ]);

            // Clearing the array unlinks everything.
            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: { ...VALID, tags: [] } })
                .expect(200);
            expect(await linkedIds(agent, 'article', id, 'tags')).toEqual([]);
        });

        it('422s a many-to-many target in another workspace', async () => {
            const other = await seedWorkspace({
                name: 'WS Two',
                slug: 'ws-two'
            });
            const foreignTag = await seedTagIn(other.id, 'foreign');

            const agent = await login(ADMIN_EMAIL);
            const res = await agent
                .post('/api/content/article')
                .send({ values: { ...VALID, tags: [foreignTag] } })
                .expect(422);
            const fields = (res.body.issues as { field: string }[]).map(
                (issue) => issue.field
            );
            expect(fields).toContain('tags');
        });

        it('reads and writes the inverse side (tag.articles) two-way', async () => {
            const agent = await login(ADMIN_EMAIL);
            const tagId = await seedTagIn(workspaceId, 'engineering');
            const articleId = await createArticle(agent, VALID);

            // Link from the tag side: the same join rows the article owns.
            await agent
                .patch(`/api/content/tag/${tagId}`)
                .send({ values: { name: 'engineering', articles: [articleId] } })
                .expect(200);

            // The link is visible from both sides.
            expect(await linkedIds(agent, 'tag', tagId, 'articles')).toEqual([
                articleId
            ]);
            expect(await linkedIds(agent, 'article', articleId, 'tags')).toEqual(
                [tagId]
            );
        });

        it('404s the relations read for a missing entry', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .get(
                    '/api/content/article/00000000-0000-4000-8000-000000000000/relations'
                )
                .expect(404);
        });

        it('links and unlinks via relation deltas on save', async () => {
            const agent = await login(ADMIN_EMAIL);
            const eng = await seedTagIn(workspaceId, 'engineering');
            const design = await seedTagIn(workspaceId, 'design');

            // Link on create, in the same request as the values.
            const create = await agent
                .post('/api/content/article')
                .send({ values: VALID, relations: { tags: { link: [eng, design] } } })
                .expect(201);
            const id = create.body.id as string;
            expect((await linkedIds(agent, 'article', id, 'tags')).sort()).toEqual(
                [eng, design].sort()
            );

            // Unlink on update, via the save payload.
            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: VALID, relations: { tags: { unlink: [eng] } } })
                .expect(200);
            expect(await linkedIds(agent, 'article', id, 'tags')).toEqual([
                design
            ]);
        });

        it('merges a link delta onto existing links (append, not override)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const [a, b, c, d, e] = await Promise.all([
                seedTagIn(workspaceId, 'aa'),
                seedTagIn(workspaceId, 'bb'),
                seedTagIn(workspaceId, 'cc'),
                seedTagIn(workspaceId, 'dd'),
                seedTagIn(workspaceId, 'ee')
            ]);
            // Start with three linked tags.
            const id = await createArticle(agent, { ...VALID, tags: [a, b, c] });

            // A link delta of two more must MERGE to five — not replace with two.
            // The save body carries no `tags` in `values`, so the whole-set path
            // can't wipe them.
            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: VALID, relations: { tags: { link: [d, e] } } })
                .expect(200);
            expect(
                (await linkedIds(agent, 'article', id, 'tags')).sort()
            ).toEqual([a, b, c, d, e].sort());

            // Re-linking already-linked ids is idempotent (no duplicates).
            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: VALID, relations: { tags: { link: [a, d] } } })
                .expect(200);
            expect(
                await linkedIds(agent, 'article', id, 'tags')
            ).toHaveLength(5);
        });

        it('persists order via the reorder delta on save', async () => {
            const agent = await login(ADMIN_EMAIL);
            const a = await seedTagIn(workspaceId, 'aaa');
            const b = await seedTagIn(workspaceId, 'bbb');
            const c = await seedTagIn(workspaceId, 'ccc');
            const id = await createArticle(agent, {
                ...VALID,
                tags: [a, b, c]
            });

            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: VALID, relations: { tags: { order: [c, a, b] } } })
                .expect(200);
            expect(await linkedIds(agent, 'article', id, 'tags')).toEqual([
                c,
                a,
                b
            ]);
        });

        it('paginates a field with many links', async () => {
            const agent = await login(ADMIN_EMAIL);
            const tagIds: string[] = [];
            for (let i = 0; i < 5; i++) {
                tagIds.push(await seedTagIn(workspaceId, `tag-${i}`));
            }
            const id = await createArticle(agent, {
                ...VALID,
                tags: tagIds
            });

            const page1 = await agent
                .get(`/api/content/article/${id}/relations/tags`)
                .query({ page: 1, pageSize: 2 })
                .expect(200);
            expect(page1.body.items).toHaveLength(2);
            expect(page1.body.total).toBe(5);

            const page3 = await agent
                .get(`/api/content/article/${id}/relations/tags`)
                .query({ page: 3, pageSize: 2 })
                .expect(200);
            expect(page3.body.items).toHaveLength(1);
        });

        it('400s a relation delta on a single relation', async () => {
            const agent = await login(ADMIN_EMAIL);
            const author = (
                await agent
                    .post('/api/content/author')
                    .send({ values: { name: 'Ada' } })
                    .expect(201)
            ).body.id as string;
            const id = await createArticle(agent);
            await agent
                .patch(`/api/content/article/${id}`)
                .send({ values: VALID, relations: { author: { link: [author] } } })
                .expect(400);
        });

        it('400s a malformed relation delta (non-array unlink), not a 500', async () => {
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);
            await agent
                .patch(`/api/content/article/${id}`)
                .send({
                    values: VALID,
                    relations: { tags: { unlink: 'not-an-array' } }
                })
                .expect(400);
        });

        it('400s a relation delta carrying a non-uuid id', async () => {
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);
            await agent
                .patch(`/api/content/article/${id}`)
                .send({
                    values: VALID,
                    relations: { tags: { link: ['not-a-uuid'] } }
                })
                .expect(400);
        });

        it('422s linking a target in another workspace via a delta', async () => {
            const other = await seedWorkspace({
                name: 'WS Two',
                slug: 'ws-two'
            });
            const foreignTag = await seedTagIn(other.id, 'foreign');
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);
            await agent
                .patch(`/api/content/article/${id}`)
                .send({
                    values: VALID,
                    relations: { tags: { link: [foreignTag] } }
                })
                .expect(422);
        });

        it('links the inverse side (tag.articles) via a delta on save', async () => {
            const agent = await login(ADMIN_EMAIL);
            const tagId = await seedTagIn(workspaceId, 'engineering');
            const articleId = await createArticle(agent, VALID);

            // Link from the tag side via a delta — the same join rows the
            // article owns, so the link shows on both sides.
            await agent
                .patch(`/api/content/tag/${tagId}`)
                .send({
                    values: { name: 'engineering' },
                    relations: { articles: { link: [articleId] } }
                })
                .expect(200);
            expect(await linkedIds(agent, 'tag', tagId, 'articles')).toEqual([
                articleId
            ]);
            expect(await linkedIds(agent, 'article', articleId, 'tags')).toEqual(
                [tagId]
            );
        });

        it('applies link, unlink, and order in one delta on save', async () => {
            const agent = await login(ADMIN_EMAIL);
            const [a, b, c, d] = await Promise.all([
                seedTagIn(workspaceId, 'aa'),
                seedTagIn(workspaceId, 'bb'),
                seedTagIn(workspaceId, 'cc'),
                seedTagIn(workspaceId, 'dd')
            ]);
            const id = await createArticle(agent, { ...VALID, tags: [a, b, c] });

            // Unlink a, link d, and reorder — all in a single save.
            await agent
                .patch(`/api/content/article/${id}`)
                .send({
                    values: VALID,
                    relations: {
                        tags: { unlink: [a], link: [d], order: [d, c, b] }
                    }
                })
                .expect(200);
            expect(await linkedIds(agent, 'article', id, 'tags')).toEqual([
                d,
                c,
                b
            ]);
        });

        it('drops a link when its target is hard-deleted (FK cascade)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const [a, b] = await Promise.all([
                seedTagIn(workspaceId, 'aa'),
                seedTagIn(workspaceId, 'bb')
            ]);
            const id = await createArticle(agent, { ...VALID, tags: [a, b] });

            // `tag` isn't paranoid, so this hard-deletes the row; the join rows
            // cascade, so the article's link to it disappears.
            await agent.delete(`/api/content/tag/${a}`).expect(204);
            expect(await linkedIds(agent, 'article', id, 'tags')).toEqual([b]);
        });
    });

    describe('publish / unpublish', () => {
        it('publishes then unpublishes a draft', async () => {
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);

            const published = await agent
                .post(`/api/content/article/${id}/publish`)
                .expect(201);
            expect(published.body.status).toBe('published');

            const reverted = await agent
                .post(`/api/content/article/${id}/unpublish`)
                .expect(201);
            expect(reverted.body.status).toBe('draft');
        });

        it('400s publishing a non-publishable type', async () => {
            const agent = await login(ADMIN_EMAIL);
            await agent
                .post(
                    '/api/content/landing/00000000-0000-4000-8000-000000000000/publish'
                )
                .expect(400);
        });
    });

    describe('delete / restore / purge (paranoid)', () => {
        it('soft-deletes, hides from the list, lists in trash, restores, purges', async () => {
            const agent = await login(ADMIN_EMAIL);
            const id = await createArticle(agent);

            await agent.delete(`/api/content/article/${id}`).expect(204);

            // Gone from the default list…
            const live = await agent.get('/api/content/article').expect(200);
            expect(live.body.items.map((i: { id: string }) => i.id)).not.toContain(id);

            // …but present in the trash view.
            const trash = await agent
                .get('/api/content/article?deleted=only')
                .expect(200);
            expect(trash.body.items.map((i: { id: string }) => i.id)).toContain(id);

            // Reading a soft-deleted row 404s.
            await agent.get(`/api/content/article/${id}`).expect(404);

            // Restore brings it back to the live list.
            await agent
                .post(`/api/content/article/${id}/restore`)
                .expect(201);
            const relisted = await agent.get('/api/content/article').expect(200);
            expect(relisted.body.items.map((i: { id: string }) => i.id)).toContain(id);

            // Delete again, then purge permanently.
            await agent.delete(`/api/content/article/${id}`).expect(204);
            await agent
                .delete(`/api/content/article/${id}/permanent`)
                .expect(204);
            const trashAfter = await agent
                .get('/api/content/article?deleted=only')
                .expect(200);
            expect(
                trashAfter.body.items.map((i: { id: string }) => i.id)
            ).not.toContain(id);
        });
    });

    describe('bulk', () => {
        it('previews then publishes only the valid drafts (and hits the bulk route, not :id)', async () => {
            const agent = await login(ADMIN_EMAIL);
            const ids = [
                await createArticle(agent),
                await createArticle(agent),
                await createArticle(agent)
            ];

            const preview = await agent
                .post('/api/content/article/bulk/publish/preview')
                .send({ ids })
                .expect(200);
            expect(preview.body.items).toHaveLength(3);
            expect(
                preview.body.items.every(
                    (item: { verdict: string }) =>
                        item.verdict === 'publishable'
                )
            ).toBe(true);

            // If `/bulk/publish` had matched `:id/publish`, the uuid pipe would
            // have 400'd the literal `bulk` — a 200 here proves the ordering.
            const publish = await agent
                .post('/api/content/article/bulk/publish')
                .send({ ids })
                .expect(200);
            expect(publish.body.published).toHaveLength(3);
            expect(publish.body.skipped).toHaveLength(0);
        });

        it('bulk soft-deletes a set of entries', async () => {
            const agent = await login(ADMIN_EMAIL);
            const ids = [
                await createArticle(agent),
                await createArticle(agent)
            ];
            const res = await agent
                .post('/api/content/article/bulk/delete')
                .send({ ids })
                .expect(200);
            expect(res.body.count).toBe(2);
        });
    });

    describe('authorization', () => {
        it('401s unauthenticated writes', async () => {
            await request(harness.server)
                .post('/api/content/article')
                .send({ values: VALID })
                .expect(401);
        });

        it('403s a viewer on create and delete', async () => {
            const viewer = await seedActiveUser(harness.app, {
                email: VIEWER_EMAIL,
                password: PASSWORD,
                role: 'viewer'
            });
            // Member of the workspace, so the 403 is the PermissionsGuard (no
            // content:write), not a WorkspaceGuard rejection.
            await seedMembership(viewer.id, workspaceId);
            const agent = await login(VIEWER_EMAIL);
            await agent
                .post('/api/content/article')
                .send({ values: VALID })
                .expect(403);
            await agent
                .delete(
                    '/api/content/article/00000000-0000-4000-8000-000000000000'
                )
                .expect(403);
        });

        it('lets a contributor create but not delete', async () => {
            const contributor = await seedActiveUser(harness.app, {
                email: CONTRIB_EMAIL,
                password: PASSWORD,
                role: 'contributor'
            });
            await seedMembership(contributor.id, workspaceId);
            const agent = await login(CONTRIB_EMAIL);
            const id = await createArticle(agent);
            await agent.delete(`/api/content/article/${id}`).expect(403);
        });
    });
});
