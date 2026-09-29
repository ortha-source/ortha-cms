import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedAllSharedContentGrants,
    seedContentGrants,
    seedMembership,
    seedSharedContentGrants,
    seedTags,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';

const ADMIN_EMAIL = 'shared-content-grants@example.com';
const PASSWORD = 'SecurePass123!';

/** Published-now columns for a seeded row. */
const PUBLISHED = { status: 'published', publishedAt: new Date() } as const;

/** The refusal a write to a shared-only type gets. `test_tag`'s label. */
const SHARED_ONLY =
    'This workspace can only use "Test tags" records from shared workspaces; it cannot create its own.';

const VALID_ARTICLE = { text: 'An article', select: 'article' } as const;

/** One list item, as far as these tests read it. */
interface Item {
    id: string;
    source?: { workspaceId: string; workspaceName: string } | null;
}

/** One `GET /content-schema` item, as far as these tests read it. */
interface SchemaItem {
    name: string;
    access?: {
        own: boolean;
        sharedSources: { workspaceId: string; workspaceName: string }[];
    };
}

/**
 * **Explicit per-source grants** (ADR-0019) on the content surfaces — what a
 * shared grant `(W, test_tag, Library)` exposes, and what an own grant does
 * not. Three consumers, one per shape:
 *
 * - **shared-only** — owns `test_article` / `test_review`, reads `test_tag`
 *   from Library: can list, open and link Library's tags, cannot create one;
 * - **own-only** — owns every type, holds no shared grant: Library's records
 *   are invisible to it however shared Library is (the implicit rule is gone);
 * - **both** — owns every type and reads every type from Library.
 *
 * Plus: an inert grant (Library unshared) exposes nothing; `access` on the
 * content-schema; the public REST/GraphQL union; and `content:I-50`, which
 * waives a required relation only when its target is unreachable.
 */
describe('Explicit per-source content grants (content surfaces)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    /** Shared; owns every type. */
    let libraryId: string;
    let sharedOnlyId: string;
    let ownOnlyId: string;
    let bothId: string;
    /** Published tag in Library. */
    let libraryTag: string;
    /** Draft tag in Library. */
    let libraryDraft: string;
    /** Own-only's own tag. */
    let ownOnlyTag: string;

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
        libraryId = (
            await seedWorkspace({
                name: 'Library',
                slug: 'library',
                isShared: true
            })
        ).id;
        sharedOnlyId = (
            await seedWorkspace({ name: 'Shared only', slug: 'shared-only' })
        ).id;
        ownOnlyId = (
            await seedWorkspace({ name: 'Own only', slug: 'own-only' })
        ).id;
        bothId = (await seedWorkspace({ name: 'Both', slug: 'both' })).id;
        for (const id of [libraryId, sharedOnlyId, ownOnlyId, bothId]) {
            await seedMembership(admin.id, id);
        }
        await seedAllContentGrants(libraryId);
        await seedContentGrants(sharedOnlyId, ['test_article', 'test_review']);
        await seedSharedContentGrants(sharedOnlyId, libraryId, ['test_tag']);
        await seedAllContentGrants(ownOnlyId);
        await seedAllContentGrants(bothId);
        await seedAllSharedContentGrants(bothId, libraryId);

        [libraryTag, libraryDraft] = await seedTags(
            [{ name: 'Library tag', ...PUBLISHED }, { name: 'Library draft' }],
            libraryId
        );
        [ownOnlyTag] = await seedTags(
            [{ name: 'Own tag', ...PUBLISHED }],
            ownOnlyId
        );
    });

    async function login(workspaceId: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function listIds(
        agent: request.Agent,
        typeName: string,
        source?: 'own' | 'shared' | 'all'
    ): Promise<string[]> {
        const res = await agent
            .get(`/api/content/${typeName}`)
            .query(source ? { source } : {})
            .expect(200);
        return (res.body.items as Item[]).map((item) => item.id).sort();
    }

    async function unshareLibrary() {
        await getPool().query(
            'UPDATE workspaces SET is_shared = false WHERE id = $1',
            [libraryId]
        );
    }

    describe('a shared-only type', () => {
        it('lists nothing as `own` and the source’s published records as `shared` / `all`', async () => {
            const agent = await login(sharedOnlyId);
            expect(await listIds(agent, 'test_tag')).toEqual([]);
            expect(await listIds(agent, 'test_tag', 'own')).toEqual([]);
            expect(await listIds(agent, 'test_tag', 'shared')).toEqual([
                libraryTag
            ]);
            expect(await listIds(agent, 'test_tag', 'all')).toEqual([
                libraryTag
            ]);
        });

        it('opens a source record read-only, and 404s its draft', async () => {
            const agent = await login(sharedOnlyId);
            const res = await agent
                .get(`/api/content/test_tag/${libraryTag}`)
                .expect(200);
            expect(res.body).toMatchObject({
                readOnly: true,
                source: { workspaceId: libraryId, workspaceName: 'Library' }
            });
            await agent
                .get(`/api/content/test_tag/${libraryDraft}`)
                .expect(404);
        });

        it('links a source record from an owned type', async () => {
            const agent = await login(sharedOnlyId);
            const created = await agent
                .post('/api/content/test_article')
                .send({
                    values: VALID_ARTICLE,
                    relations: { tags: { link: [libraryTag] } }
                })
                .expect(201);
            const tags = await agent
                .get(
                    `/api/content/test_article/${created.body.id}/relations/tags`
                )
                .expect(200);
            expect(
                (tags.body.items as Item[]).map((item) => [
                    item.id,
                    item.source?.workspaceId
                ])
            ).toEqual([[libraryTag, libraryId]]);
        });

        it('403s every write with the shared-only message — not the unknown-type 404', async () => {
            const agent = await login(sharedOnlyId);
            const create = await agent
                .post('/api/content/test_tag')
                .send({ values: { name: 'Mine' } })
                .expect(403);
            expect(create.body.message).toBe(SHARED_ONLY);

            await agent
                .patch(`/api/content/test_tag/${libraryTag}`)
                .send({ values: { name: 'Edited' } })
                .expect(403);
            await agent
                .post(`/api/content/test_tag/${libraryTag}/unpublish`)
                .expect(403);
            await agent
                .delete(`/api/content/test_tag/${libraryTag}`)
                .expect(403);
            await agent
                .post('/api/content/test_tag/bulk/delete')
                .send({ ids: [libraryTag] })
                .expect(403);
        });

        it('keeps an unreachable type a 404 — no enumeration signal', async () => {
            const agent = await login(sharedOnlyId);
            await agent.get('/api/content/test_author').expect(404);
            await agent
                .post('/api/content/test_author')
                .send({ values: { name: 'x' } })
                .expect(404);
        });
    });

    describe('an own-only type', () => {
        it('never shows a shared workspace’s records — list, picker, open, link', async () => {
            const agent = await login(ownOnlyId);
            expect(await listIds(agent, 'test_tag', 'all')).toEqual([
                ownOnlyTag
            ]);
            expect(await listIds(agent, 'test_tag', 'shared')).toEqual([]);
            await agent.get(`/api/content/test_tag/${libraryTag}`).expect(404);
            await agent
                .post('/api/content/test_article')
                .send({
                    values: VALID_ARTICLE,
                    relations: { tags: { link: [libraryTag] } }
                })
                .expect(422);
        });
    });

    describe('own and shared grants of one type', () => {
        it('unions both and still creates own records', async () => {
            const agent = await login(bothId);
            const created = await agent
                .post('/api/content/test_tag')
                .send({ values: { name: 'Both tag' } })
                .expect(201);
            expect(await listIds(agent, 'test_tag', 'all')).toEqual(
                [libraryTag, created.body.id as string].sort()
            );
            expect(await listIds(agent, 'test_tag')).toEqual([created.body.id]);
        });
    });

    describe('GET /api/content/:typeName?sourceWorkspaceId= (one source)', () => {
        let brandId: string;
        let brandTag: string;
        let bothTag: string;

        beforeEach(async () => {
            brandId = (
                await seedWorkspace({
                    name: 'Brand',
                    slug: 'brand',
                    isShared: true
                })
            ).id;
            await seedContentGrants(brandId, ['test_tag']);
            await seedSharedContentGrants(bothId, brandId, ['test_tag']);
            [brandTag] = await seedTags(
                [{ name: 'Brand tag', ...PUBLISHED }],
                brandId
            );
            [bothTag] = await seedTags(
                [{ name: 'Both own tag', ...PUBLISHED }],
                bothId
            );
        });

        function page(agent: request.Agent, query: Record<string, string>) {
            return agent.get('/api/content/test_tag').query(query);
        }

        it('narrows items and total to that one shared source', async () => {
            const agent = await login(bothId);
            expect(await listIds(agent, 'test_tag', 'all')).toEqual(
                [libraryTag, brandTag, bothTag].sort()
            );

            const library = await page(agent, {
                source: 'shared',
                sourceWorkspaceId: libraryId
            }).expect(200);
            expect(library.body.total).toBe(1);
            expect((library.body.items as Item[]).map((i) => i.id)).toEqual([
                libraryTag
            ]);

            const brand = await page(agent, {
                source: 'all',
                sourceWorkspaceId: brandId,
                pageSize: '1'
            }).expect(200);
            expect(brand.body).toMatchObject({ total: 1, pageSize: 1 });
            expect((brand.body.items as Item[])[0].id).toBe(brandTag);

            const own = await page(agent, {
                source: 'all',
                sourceWorkspaceId: bothId
            }).expect(200);
            expect((own.body.items as Item[]).map((i) => i.id)).toEqual([
                bothTag
            ]);
        });

        it('400s every id that is not a visible source here, and a missing mode — one answer', async () => {
            const agent = await login(bothId);
            const cases: Record<string, string>[] = [
                { sourceWorkspaceId: libraryId },
                { source: 'own', sourceWorkspaceId: libraryId },
                // Own id: visible under `all` only — it is not a shared source.
                { source: 'shared', sourceWorkspaceId: bothId },
                // A workspace that is no source of the type here.
                { source: 'shared', sourceWorkspaceId: ownOnlyId },
                // One that does not exist.
                {
                    source: 'shared',
                    sourceWorkspaceId: '00000000-0000-4000-8000-000000000000'
                },
                { source: 'shared', sourceWorkspaceId: 'not-a-uuid' }
            ];
            const messages = new Set<string>();
            for (const query of cases) {
                const res = await page(agent, query).expect(400);
                if (query['sourceWorkspaceId'] !== 'not-a-uuid') {
                    messages.add(JSON.stringify(res.body.message));
                }
            }
            expect(messages.size).toBe(1);
        });

        it('400s an inert source', async () => {
            await unshareLibrary();
            const agent = await login(bothId);
            await page(agent, {
                source: 'shared',
                sourceWorkspaceId: libraryId
            }).expect(400);
        });
    });

    describe('an inert shared grant', () => {
        it('exposes nothing once the source is unshared, and the type becomes unreachable', async () => {
            await unshareLibrary();
            const agent = await login(sharedOnlyId);
            await agent.get('/api/content/test_tag').expect(404);
            await agent.get(`/api/content/test_tag/${libraryTag}`).expect(404);
            await agent.get('/api/content-schema/test_tag').expect(404);
            await agent
                .post('/api/content/test_article')
                .send({
                    values: VALID_ARTICLE,
                    relations: { tags: { link: [libraryTag] } }
                })
                .expect(422);

            const both = await login(bothId);
            expect(await listIds(both, 'test_tag', 'all')).toEqual([]);
        });
    });

    describe('GET /api/content-schema access', () => {
        it('reports own and the available shared sources per type', async () => {
            const agent = await login(sharedOnlyId);
            const res = await agent.get('/api/content-schema').expect(200);
            const byName = new Map(
                (res.body as SchemaItem[]).map((item) => [item.name, item])
            );
            expect(byName.get('test_tag')?.access).toEqual({
                own: false,
                sharedSources: [
                    { workspaceId: libraryId, workspaceName: 'Library' }
                ]
            });
            expect(byName.get('test_article')?.access).toEqual({
                own: true,
                sharedSources: []
            });
            expect(byName.get('test_author')?.access).toEqual({
                own: false,
                sharedSources: []
            });
        });

        it('stays global without X-Workspace-Id, and 403s a workspace the caller is not in', async () => {
            const agent = request.agent(harness.server);
            await agent
                .post('/api/auth/login')
                .send({ email: ADMIN_EMAIL, password: PASSWORD })
                .expect(201);
            const res = await agent.get('/api/content-schema').expect(200);
            expect(
                (res.body as SchemaItem[]).some((item) => 'access' in item)
            ).toBe(false);

            const stranger = (
                await seedWorkspace({ name: 'Stranger', slug: 'stranger' })
            ).id;
            await agent
                .get('/api/content-schema')
                .set('X-Workspace-Id', stranger)
                .expect(403);
        });

        it('serves the detail and filter fields of a shared-only type, with the same access', async () => {
            const agent = await login(sharedOnlyId);
            const detail = await agent
                .get('/api/content-schema/test_tag')
                .expect(200);
            expect(detail.body.access).toEqual({
                own: false,
                sharedSources: [
                    { workspaceId: libraryId, workspaceName: 'Library' }
                ]
            });
            await agent
                .get('/api/content-schema/test_tag/filter-fields')
                .expect(200);
            await agent.get('/api/content-schema/test_author').expect(404);
        });
    });

    describe('the public API', () => {
        async function token(
            workspaceId: string,
            scope: 'read' | 'full'
        ): Promise<string> {
            const agent = await login(workspaceId);
            const res = await agent
                .post('/api/api-tokens')
                .send({ name: 'grants', workspaceIds: [workspaceId], scope })
                .expect(201);
            return res.body.secret as string;
        }

        it('lists the union of visible sources, types included, and refuses a write', async () => {
            const secret = await token(sharedOnlyId, 'full');
            const list = await request(harness.server)
                .get('/api/v1/content/test_tag')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect((list.body.items as Item[]).map((item) => item.id)).toEqual([
                libraryTag
            ]);

            const types = await request(harness.server)
                .get('/api/v1/content-types')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(
                (types.body.items as { name: string }[])
                    .map((type) => type.name)
                    .sort()
            ).toEqual(['test_article', 'test_review', 'test_tag']);

            const write = await request(harness.server)
                .post('/api/v1/content/test_tag')
                .set('Authorization', `Bearer ${secret}`)
                .send({ values: { name: 'Mine' } })
                .expect(403);
            expect(write.body.message).toBe(SHARED_ONLY);
        });

        it('keeps an own-only workspace’s list to its own records', async () => {
            const secret = await token(ownOnlyId, 'read');
            const list = await request(harness.server)
                .get('/api/v1/content/test_tag')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect((list.body.items as Item[]).map((item) => item.id)).toEqual([
                ownOnlyTag
            ]);
        });

        it('puts a shared-only type in the GraphQL schema and resolves it', async () => {
            const secret = await token(sharedOnlyId, 'read');
            const sdl = await request(harness.server)
                .get('/api/v1/graphql')
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);
            expect(sdl.text).toContain('testTags(');
            expect(sdl.text).not.toContain('testAuthors(');

            const res = await request(harness.server)
                .post('/api/v1/graphql')
                .set('Authorization', `Bearer ${secret}`)
                .send({ query: '{ testTags(pageSize: 5) { items { name } } }' })
                .expect(200);
            expect(res.body.errors).toBeUndefined();
            expect(res.body.data.testTags.items).toEqual([
                { name: 'Library tag' }
            ]);
        });
    });

    describe('required relations [content:I-50]', () => {
        it('does not waive a relation whose target is reachable only through a shared grant', async () => {
            const agent = await login(sharedOnlyId);
            const created = await agent
                .post('/api/content/test_review')
                .send({ values: { title: 'A review' } })
                .expect(201);

            const blocked = await agent
                .post(`/api/content/test_review/${created.body.id}/publish`)
                .expect(422);
            // `seo` targets a type this workspace cannot reach — still waived.
            expect(
                (blocked.body.issues as { field: string }[]).map(
                    (issue) => issue.field
                )
            ).toEqual(['tags']);

            // With the source unshared the target is unreachable again, and
            // the requirement is waived as before.
            await unshareLibrary();
            await agent
                .post(`/api/content/test_review/${created.body.id}/publish`)
                .expect(201);
        });
    });
});
