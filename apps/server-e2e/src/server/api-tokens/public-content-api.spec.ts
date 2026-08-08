import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedArticles,
    seedArticleTags,
    seedContentGrants,
    seedLanding,
    seedPages,
    seedTags,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'public-api-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** Shape of one item in the public list envelope (only the asserted bits). */
interface PublicItem {
    id: string;
    publishedAt?: string | null;
    values: Record<string, unknown>;
    relations?: Record<
        string,
        { items: { id: string; title: string }[]; total: number }
    >;
    media?: Record<string, { items: { id: string }[]; total: number }>;
}

/** Shape of one summary in the public content-type list. */
interface TypeSummary {
    name: string;
}

/**
 * `/api/v1/...` — the PUBLIC, token-authenticated content read API. Covers the
 * bearer guard, the workspace bucket (single- vs multi-workspace tokens), the
 * published-only visibility rule, grant pruning, and the schema-discovery
 * routes.
 *
 * These routes are `@Public()`, so the session `AuthGuard` never runs on them —
 * a bearer token is the only way in, and a session cookie is not accepted.
 */
describe('Public content API (/api/v1)', () => {
    let harness: TestApp;
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
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
        otherWorkspaceId = (await seedWorkspace({ name: 'WS B', slug: 'ws-b' }))
            .id;
        // Both workspaces expose the article collection; `test_page` is
        // deliberately left ungranted so the grant gate has something to hide.
        await seedContentGrants(workspaceId, ['test_article']);
        await seedContentGrants(otherWorkspaceId, ['test_article']);
    });

    /** Logs in as the admin and returns a cookie-bearing agent. */
    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Mints a token through the real management API and returns its secret. */
    async function mintToken(options: {
        workspaceIds: string[];
        scope?: 'read' | 'full';
    }): Promise<{ id: string; secret: string }> {
        const agent = await login();
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'e2e',
                workspaceIds: options.workspaceIds,
                scope: options.scope ?? 'read'
            })
            .expect(201);
        return { id: res.body.id, secret: res.body.secret };
    }

    /** Seeds one published article in `workspaceId` and returns its id. */
    async function seedPublished(text: string, ws = workspaceId) {
        const [id] = await seedArticles(
            [
                {
                    text,
                    select: 'article',
                    status: 'published',
                    publishedAt: new Date()
                }
            ],
            ws
        );
        return id;
    }

    describe('authentication', () => {
        it('401s without an Authorization header', async () => {
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .expect(401);
        });

        it('401s on an unknown bearer token', async () => {
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', 'Bearer orthacms_not-a-real-token')
                .expect(401);
        });

        it('401s on a non-bearer Authorization scheme', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Basic ${secret}`)
                .expect(401);
        });

        it('does not accept a session cookie in place of a token', async () => {
            const agent = await login();
            await agent.get('/api/v1/content/test_article').expect(401);
        });

        it('401s once the token is revoked', async () => {
            const { id, secret } = await mintToken({
                workspaceIds: [workspaceId]
            });
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            const agent = await login();
            await agent.delete(`/api/api-tokens/${id}`).expect(204);

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(401);
        });

        it('does not open the management API to a bearer token', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId],
                scope: 'full'
            });
            // The `/api/api-tokens` routes are session-authenticated; a bearer
            // token must never manage tokens, whatever its scope.
            await request(harness.server)
                .get('/api/api-tokens')
                .set('Authorization', `Bearer ${secret}`)
                .expect(401);
        });
    });

    describe('workspace resolution', () => {
        it('defaults to the only workspace of a single-workspace token', async () => {
            await seedPublished('Only workspace');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            expect(res.body.items[0].values.text).toBe('Only workspace');
        });

        it('requires X-Workspace-Id when the token covers several', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId, otherWorkspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('reads each workspace of a multi-workspace token', async () => {
            await seedPublished('In A', workspaceId);
            await seedPublished('In B', otherWorkspaceId);
            const { secret } = await mintToken({
                workspaceIds: [workspaceId, otherWorkspaceId]
            });

            const first = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', workspaceId)
                .expect(200);
            expect(
                (first.body.items as PublicItem[]).map(
                    (item) => item.values['text']
                )
            ).toEqual(['In A']);

            const second = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', otherWorkspaceId)
                .expect(200);
            expect(
                (second.body.items as PublicItem[]).map(
                    (item) => item.values['text']
                )
            ).toEqual(['In B']);
        });

        it('403s a workspace outside the token’s bucket', async () => {
            await seedPublished('In B', otherWorkspaceId);
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', otherWorkspaceId)
                .expect(403);
        });

        it('400s a malformed X-Workspace-Id', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', 'not-a-uuid')
                .expect(400);
        });
    });

    describe('entry reads', () => {
        it('serves only published, non-deleted entries', async () => {
            await seedPublished('Live');
            await seedArticles(
                [{ text: 'Draft', select: 'article' }],
                workspaceId
            );
            await seedArticles(
                [
                    {
                        text: 'Trashed',
                        select: 'article',
                        status: 'published',
                        publishedAt: new Date(),
                        deletedAt: new Date()
                    }
                ],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            expect(res.body.items[0].values.text).toBe('Live');
        });

        it('returns a flat entry: no relations, no media, no workspace, no status', async () => {
            await seedPublished('Flat');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            const [item] = res.body.items as PublicItem[];
            expect(item).toHaveProperty('publishedAt');
            expect(item).not.toHaveProperty('status');
            expect(item).not.toHaveProperty('workspaceId');

            // The entry's own data rides `values` — scalars plus the jsonb
            // bags (`multiselect`, `json`), which are values, not references.
            expect(item.values).toHaveProperty('text');
            expect(item.values).toHaveProperty('multiselect');
            expect(item.values).toHaveProperty('json');

            // Every reference field is omitted: many-to-one (`author`, an FK
            // column that IS on the row), one-to-one (`seo`), many-to-many
            // (`tags`), and media both single and multiple. `test_article`
            // declares no inverse relation, so that cardinality is covered by
            // `public-entry-row.spec.ts` rather than asserted vacuously here.
            for (const omitted of [
                'author',
                'seo',
                'tags',
                'image',
                'heroImage',
                'attachments'
            ]) {
                expect(item.values).not.toHaveProperty(omitted);
            }
        });

        it('reads one entry by id', async () => {
            const id = await seedPublished('By id');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.id).toBe(id);
            expect(res.body.values.text).toBe('By id');
        });

        it('404s a draft entry by id', async () => {
            const [id] = await seedArticles(
                [{ text: 'Draft', select: 'article' }],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('404s an entry that lives in another workspace', async () => {
            const id = await seedPublished('In B', otherWorkspaceId);
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('404s a content type the workspace was not granted', async () => {
            await seedPages([{ title: 'Hidden' }], workspaceId);
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_page')
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('404s an unknown content type', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/no_such_type')
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('serves a single (page) type through the same list route', async () => {
            await seedContentGrants(workspaceId, ['test_landing'], 'single');
            await seedLanding(
                [{ text: 'Home page', select: 'light' }],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_landing')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            // Non-publishable, so it is always live and carries no publish
            // timestamp.
            expect(res.body.items[0]).not.toHaveProperty('publishedAt');
            expect(res.body.items[0].values.text).toBe('Home page');
        });

        it('paginates', async () => {
            await seedPublished('One');
            await seedPublished('Two');
            await seedPublished('Three');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ page: 2, pageSize: 2 })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(3);
            expect(res.body.page).toBe(2);
            expect(res.body.pageSize).toBe(2);
            expect(res.body.items).toHaveLength(1);
        });

        it('searches across the type’s text columns', async () => {
            await seedPublished('Alpha release notes');
            await seedPublished('Beta announcement');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ search: 'release' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            expect((res.body.items as PublicItem[])[0].values['text']).toBe(
                'Alpha release notes'
            );
        });

        it('filters on a scalar field with the query-builder tree', async () => {
            await seedArticles(
                [
                    {
                        text: 'A tutorial',
                        select: 'tutorial',
                        status: 'published',
                        publishedAt: new Date()
                    },
                    {
                        text: 'An article',
                        select: 'article',
                        status: 'published',
                        publishedAt: new Date()
                    }
                ],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [{ field: 'select', op: 'eq', value: 'tutorial' }]
                    })
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            expect((res.body.items as PublicItem[])[0].values['text']).toBe(
                'A tutorial'
            );
        });

        it('never lets a filter widen the published-only scope', async () => {
            await seedPublished('Live');
            await seedArticles(
                [{ text: 'Draft', select: 'article' }],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // `status` is not in the public filter schema — it could only ever
            // be a no-op or match nothing, so it is a clear 400 rather than a
            // confusingly empty page.
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [{ field: 'status', op: 'eq', value: 'draft' }]
                    })
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);

            // And a filter that matches every row — both entries were created
            // just now, so this is deliberately satisfied by the draft too —
            // still cannot surface it: the filter is AND-ed onto the
            // published-only predicate, so it can only ever narrow.
            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [
                            {
                                field: 'createdAt',
                                op: 'gte',
                                value: '2000-01-01'
                            }
                        ]
                    })
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            expect(
                (res.body.items as PublicItem[]).map(
                    (item) => item.values['text']
                )
            ).toEqual(['Live']);
        });

        it('400s a malformed filter and an unknown filter field', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ filter: 'not json' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [{ field: 'nope', op: 'eq', value: 'x' }]
                    })
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('400s a filter traversing into an ungranted relation', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // `test_author` is not granted to this workspace, so the surface
            // omits the traversal — a token can't infer relation data it isn't
            // allowed to read by watching which entries match.
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({
                    filter: JSON.stringify({
                        and: [{ field: 'author.name', op: 'eq', value: 'Ada' }]
                    })
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('returns only the selected fields', async () => {
            await seedPublished('Sparse');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ fields: 'text,select' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            const [item] = res.body.items as PublicItem[];
            expect(Object.keys(item.values).sort()).toEqual(['select', 'text']);
            // The envelope is never selectable away — `id` is what makes the
            // entry addressable for a follow-up read.
            expect(item.id).toEqual(expect.any(String));
            expect(item).toHaveProperty('publishedAt');
        });

        it('applies a field selection to the single-entry route too', async () => {
            const id = await seedPublished('Sparse by id');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .query({ fields: 'text' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(Object.keys(res.body.values)).toEqual(['text']);
            expect(res.body.id).toBe(id);
        });

        it('400s an unknown or unselectable field name', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // A typo is a 400, not a silently missing key.
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ fields: 'text,nope' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);

            // A real field this API can't return yet gets its own message.
            const relation = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ fields: 'author' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
            expect(relation.body.message).toMatch(/cannot be selected/);

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ fields: 'image' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('still filters and sorts on fields it was not asked to return', async () => {
            await seedArticles(
                [
                    {
                        text: 'Keep',
                        select: 'tutorial',
                        status: 'published',
                        publishedAt: new Date()
                    },
                    {
                        text: 'Drop',
                        select: 'article',
                        status: 'published',
                        publishedAt: new Date()
                    }
                ],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // `select` drives the filter but is absent from the projection —
            // SQL allows a WHERE over unselected columns, so a sparse fieldset
            // never narrows what can be filtered or sorted on.
            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({
                    fields: 'text',
                    filter: JSON.stringify({
                        and: [{ field: 'select', op: 'eq', value: 'tutorial' }]
                    })
                })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.total).toBe(1);
            const [item] = res.body.items as PublicItem[];
            expect(item.values).toEqual({ text: 'Keep' });
        });

        it('expands a relation only when asked, and only to published targets', async () => {
            // `test_tag` is publishable, so a draft tag is the case that must
            // stay invisible. Grant it — expansion into an ungranted type is
            // refused (covered below).
            await seedContentGrants(workspaceId, ['test_tag']);
            const tagIds = await seedTags(
                [
                    {
                        name: 'Live tag',
                        status: 'published',
                        publishedAt: new Date()
                    },
                    { name: 'Draft tag' }
                ],
                workspaceId
            );
            const source = await seedPublished('Source');
            await seedArticleTags(source, tagIds);
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // Off by default.
            const plain = await request(harness.server)
                .get('/api/v1/content/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(
                (plain.body.items as PublicItem[]).every(
                    (item) => item.relations === undefined
                )
            ).toBe(true);

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ relations: 'preview', relationFields: 'tags' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            const item = (res.body.items as PublicItem[]).find(
                (row) => row.id === source
            );
            // The draft link is neither shown nor counted — `total` must not
            // advertise a link the caller can never reach.
            expect(item?.relations?.['tags'].total).toBe(1);
            expect(
                item?.relations?.['tags'].items.map((ref) => ref.title)
            ).toEqual(['Live tag']);
        });

        it('400s expanding a relation into an ungranted type', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // `test_author` is not granted to this workspace, so expanding
            // `author` would reach content the workspace doesn't expose.
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ relations: 'preview', relationFields: 'author' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('400s a relationFields name that is not a relation', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ relations: 'preview', relationFields: 'text' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('reads relations from the sibling routes', async () => {
            await seedContentGrants(workspaceId, ['test_tag']);
            const tagIds = await seedTags(
                [
                    {
                        name: 'Sibling tag',
                        status: 'published',
                        publishedAt: new Date()
                    }
                ],
                workspaceId
            );
            const source = await seedPublished('Sibling source');
            await seedArticleTags(source, tagIds);
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const all = await request(harness.server)
                .get(`/api/v1/content/test_article/${source}/relations`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(all.body.relations.tags.total).toBe(1);
            // An ungranted target is omitted from the map entirely, matching
            // what `relationFields` would refuse.
            expect(all.body.relations).not.toHaveProperty('author');

            const one = await request(harness.server)
                .get(`/api/v1/content/test_article/${source}/relations/tags`)
                .query({ page: 1, pageSize: 1 })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(one.body.items).toHaveLength(1);
            expect(one.body.items[0].title).toBe('Sibling tag');

            // A non-relation field is a 400, not an empty page.
            await request(harness.server)
                .get(`/api/v1/content/test_article/${source}/relations/text`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('404s the relation and media routes for an entry it cannot read', async () => {
            const [draft] = await seedArticles(
                [{ text: 'Hidden', select: 'article' }],
                workspaceId
            );
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // The sibling routes must be exactly as invisible as the entry.
            await request(harness.server)
                .get(`/api/v1/content/test_article/${draft}/relations`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
            await request(harness.server)
                .get(`/api/v1/content/test_article/${draft}/media`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });

        it('exposes media fields as empty views when nothing is attached', async () => {
            await seedPublished('No media');
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ media: 'preview', mediaFields: 'image,attachments' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            // The keys are present even with no assets, so a consumer can read
            // `media.image.items` without testing for the map first.
            const [item] = res.body.items as PublicItem[];
            expect(item.media?.['image']).toEqual({ items: [], total: 0 });
            expect(item.media?.['attachments']).toEqual({
                items: [],
                total: 0
            });
        });

        it('400s a mediaFields name that is not a media field', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ media: 'preview', mediaFields: 'text' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('rejects an undeclared query parameter', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            // The public surface is deliberately narrow — the admin's
            // `?deleted=only` (the trash view) is not part of it.
            await request(harness.server)
                .get('/api/v1/content/test_article')
                .query({ deleted: 'only' })
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });
    });

    describe('schema discovery', () => {
        it('lists only the types the workspace was granted', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content-types')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(
                (res.body.items as TypeSummary[]).map((type) => type.name)
            ).toEqual(['test_article']);
        });

        it('serves one type’s field schema', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            const res = await request(harness.server)
                .get('/api/v1/content-types/test_article')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(res.body.name).toBe('test_article');
            expect(res.body.publishable).toBe(true);
            expect(res.body.i18n).toBe(true);
            expect(
                (res.body.fields as { name: string }[]).map(
                    (field) => field.name
                )
            ).toContain('text');
        });

        it('404s the schema of an ungranted type', async () => {
            const { secret } = await mintToken({
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get('/api/v1/content-types/test_page')
                .set('Authorization', `Bearer ${secret}`)
                .expect(404);
        });
    });
});
