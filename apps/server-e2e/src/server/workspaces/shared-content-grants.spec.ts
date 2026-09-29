import { randomUUID } from 'node:crypto';
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
    seedContentGrants,
    seedMembership,
    seedSharedContentGrants,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';
import { runSharedGrantsBackfill } from '../../support/shared-grants-backfill';

const ADMIN_EMAIL = 'shared-grants-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** One shared grant as `WorkspaceView.sharedContent` carries it. */
interface SharedGrantView {
    slug: string;
    kind: 'collection' | 'single';
    sourceWorkspaceId: string;
    sourceWorkspaceName: string;
    available: boolean;
}

/** One `workspace_content` row, as the backfill spec reads them. */
interface GrantRow {
    workspace_id: string;
    slug: string;
    source_workspace_id: string | null;
}

/**
 * **Explicit per-source grants** (ADR-0019) on the workspaces routes: a
 * workspace holds its own grant of a type ("Tags") and/or shared grants of it
 * naming one shared workspace each ("Tags · Library"). Pins the add / remove /
 * list routes, the create DTO's `content.sharedContent`, the `sharedContent`
 * view with its `available` flag, and the migration that made the old
 * implicit rule explicit. What a grant *exposes* is pinned by
 * `content/shared-content-grants.spec.ts`.
 */
describe('Explicit per-source content grants (workspaces routes)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    /** The workspace the requests act on. */
    let consumerId: string;
    /** Shared; owns `test_tag` and `test_author`. */
    let libraryId: string;
    /** Shared; owns `test_tag`. */
    let brandId: string;
    /** Not shared; owns `test_tag`. */
    let privateId: string;
    /** Shared but archived; owns `test_tag`. */
    let archivedId: string;

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
        libraryId = (
            await seedWorkspace({
                name: 'Library',
                slug: 'library',
                isShared: true
            })
        ).id;
        brandId = (
            await seedWorkspace({
                name: 'Brand',
                slug: 'brand',
                isShared: true
            })
        ).id;
        privateId = (await seedWorkspace({ name: 'Private', slug: 'private' }))
            .id;
        archivedId = (
            await seedWorkspace({
                name: 'Archived',
                slug: 'archived',
                isShared: true
            })
        ).id;
        await archiveWorkspace(archivedId);
        await seedMembership(admin.id, consumerId);
        await seedMembership(admin.id, libraryId);
        await seedContentGrants(consumerId, ['test_article']);
        await seedContentGrants(libraryId, ['test_tag', 'test_author']);
        for (const id of [brandId, privateId, archivedId]) {
            await seedContentGrants(id, ['test_tag']);
        }
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    function addShared(
        agent: request.Agent,
        slug: string,
        sourceWorkspaceId: string,
        workspaceId = consumerId
    ) {
        return agent
            .post(`/api/workspaces/${workspaceId}/content`)
            .send({ slug, sourceWorkspaceId });
    }

    async function grantRows(workspaceId: string): Promise<GrantRow[]> {
        const { rows } = await getPool().query<GrantRow>(
            `SELECT workspace_id, slug, source_workspace_id
               FROM workspace_content
              WHERE workspace_id = $1
              ORDER BY slug, source_workspace_id NULLS FIRST`,
            [workspaceId]
        );
        return rows;
    }

    describe('GET /api/workspaces/:id/shared-sources', () => {
        it('lists every shared, active workspace but this one, with its own grants', async () => {
            const agent = await login();
            const res = await agent
                .get(`/api/workspaces/${consumerId}/shared-sources`)
                .expect(200);

            expect(res.body).toEqual({
                items: [
                    {
                        workspaceId: brandId,
                        workspaceName: 'Brand',
                        content: [{ slug: 'test_tag', kind: 'collection' }]
                    },
                    {
                        workspaceId: libraryId,
                        workspaceName: 'Library',
                        content: [
                            { slug: 'test_author', kind: 'collection' },
                            { slug: 'test_tag', kind: 'collection' }
                        ]
                    }
                ]
            });
        });

        it('leaves the workspace itself out even when it is shared', async () => {
            const agent = await login();
            const res = await agent
                .get(`/api/workspaces/${libraryId}/shared-sources`)
                .expect(200);
            expect(
                (res.body.items as { workspaceId: string }[]).map(
                    (item) => item.workspaceId
                )
            ).toEqual([brandId]);
        });

        it('offers only own grants — a shared grant is not re-exported', async () => {
            await seedSharedContentGrants(brandId, libraryId, ['test_author']);
            const agent = await login();
            const res = await agent
                .get(`/api/workspaces/${consumerId}/shared-sources`)
                .expect(200);
            expect(res.body.items[0].content).toEqual([
                { slug: 'test_tag', kind: 'collection' }
            ]);
        });

        it('403s a non-member, as every /workspaces/:id route does', async () => {
            const agent = await login();
            await agent
                .get(`/api/workspaces/${brandId}/shared-sources`)
                .expect(403);
        });

        it('401s without a session', async () => {
            await request(harness.server)
                .get(`/api/workspaces/${consumerId}/shared-sources`)
                .expect(401);
        });
    });

    describe('POST /api/workspaces/:id/content with sourceWorkspaceId', () => {
        it('adds a shared grant beside the own ones and returns it in sharedContent', async () => {
            const agent = await login();
            const res = await addShared(agent, 'test_tag', libraryId).expect(
                201
            );

            expect(res.body.content).toEqual(['test_article']);
            expect(res.body.sharedContent).toEqual([
                {
                    slug: 'test_tag',
                    kind: 'collection',
                    sourceWorkspaceId: libraryId,
                    sourceWorkspaceName: 'Library',
                    available: true
                }
            ] satisfies SharedGrantView[]);
            expect(await grantRows(consumerId)).toEqual([
                {
                    workspace_id: consumerId,
                    slug: 'test_article',
                    source_workspace_id: null
                },
                {
                    workspace_id: consumerId,
                    slug: 'test_tag',
                    source_workspace_id: libraryId
                }
            ]);
        });

        it('keeps an own grant and several shared grants of one slug apart, idempotently', async () => {
            const agent = await login();
            await agent
                .post(`/api/workspaces/${consumerId}/content`)
                .send({ slug: 'test_tag' })
                .expect(201);
            await addShared(agent, 'test_tag', libraryId).expect(201);
            await addShared(agent, 'test_tag', libraryId).expect(201);
            const res = await addShared(agent, 'test_tag', brandId).expect(201);

            expect(res.body.content.sort()).toEqual([
                'test_article',
                'test_tag'
            ]);
            expect(
                (res.body.sharedContent as SharedGrantView[]).map(
                    (grant) => grant.sourceWorkspaceName
                )
            ).toEqual(['Brand', 'Library']);
            expect(await grantRows(consumerId)).toHaveLength(4);
        });

        it.each([
            ['a workspace that is not shared', () => privateId, 'test_tag'],
            ['an archived shared workspace', () => archivedId, 'test_tag'],
            [
                'a source without its own grant of the slug',
                () => libraryId,
                'test_article'
            ],
            ['the workspace itself', () => consumerId, 'test_article'],
            ['a workspace that does not exist', () => randomUUID(), 'test_tag']
        ])('422s %s, writing nothing', async (_case, source, slug) => {
            const agent = await login();
            await addShared(agent, slug, source()).expect(422);
            expect(await grantRows(consumerId)).toHaveLength(1);
        });

        it('400s an unknown slug, a malformed source id, and an unknown field', async () => {
            const agent = await login();
            await addShared(agent, 'ghost_type', libraryId).expect(400);
            await addShared(agent, 'test_tag', 'not-a-uuid').expect(400);
            await agent
                .post(`/api/workspaces/${consumerId}/content`)
                .send({ slug: 'test_tag', sourceWorkspaceId: libraryId, x: 1 })
                .expect(400);
        });

        it('403s a non-member', async () => {
            const agent = await login();
            await addShared(agent, 'test_tag', libraryId, brandId).expect(403);
        });
    });

    describe('DELETE /api/workspaces/:id/content/:slug', () => {
        beforeEach(async () => {
            await seedContentGrants(consumerId, ['test_tag']);
            await seedSharedContentGrants(consumerId, libraryId, ['test_tag']);
            await seedSharedContentGrants(consumerId, brandId, ['test_tag']);
        });

        it('?source= removes that one shared grant and nothing else', async () => {
            const agent = await login();
            const res = await agent
                .delete(`/api/workspaces/${consumerId}/content/test_tag`)
                .query({ source: libraryId })
                .expect(200);

            expect(res.body.content.sort()).toEqual([
                'test_article',
                'test_tag'
            ]);
            expect(
                (res.body.sharedContent as SharedGrantView[]).map(
                    (grant) => grant.sourceWorkspaceId
                )
            ).toEqual([brandId]);
        });

        it('without ?source= removes the own grant only, leaving the shared ones', async () => {
            const agent = await login();
            const res = await agent
                .delete(`/api/workspaces/${consumerId}/content/test_tag`)
                .expect(200);

            expect(res.body.content).toEqual(['test_article']);
            expect(res.body.sharedContent).toHaveLength(2);
        });

        it('is a no-op for a shared grant never held, and 400s a malformed source', async () => {
            const agent = await login();
            await agent
                .delete(`/api/workspaces/${consumerId}/content/test_author`)
                .query({ source: libraryId })
                .expect(200);
            await agent
                .delete(`/api/workspaces/${consumerId}/content/test_tag`)
                .query({ source: 'nope' })
                .expect(400);
            expect(await grantRows(consumerId)).toHaveLength(4);
        });
    });

    describe('sharedContent.available', () => {
        it('turns false — the grant inert, not deleted — when the source is unshared or archived', async () => {
            await seedSharedContentGrants(consumerId, libraryId, ['test_tag']);
            const agent = await login();

            await agent
                .patch(`/api/workspaces/${libraryId}`)
                .send({ isShared: false })
                .expect(200);
            let list = await agent.get('/api/workspaces').expect(200);
            let consumer = (
                list.body as { id: string; sharedContent: SharedGrantView[] }[]
            ).find((workspace) => workspace.id === consumerId);
            expect(consumer?.sharedContent).toEqual([
                expect.objectContaining({
                    sourceWorkspaceId: libraryId,
                    available: false
                })
            ]);

            await agent
                .patch(`/api/workspaces/${libraryId}`)
                .send({ isShared: true })
                .expect(200);
            await archiveWorkspace(libraryId);
            list = await agent.get('/api/workspaces').expect(200);
            consumer = (
                list.body as { id: string; sharedContent: SharedGrantView[] }[]
            ).find((workspace) => workspace.id === consumerId);
            expect(consumer?.sharedContent[0].available).toBe(false);
        });

        it('turns false when the source drops its own grant of the type', async () => {
            await seedSharedContentGrants(consumerId, libraryId, ['test_tag']);
            const agent = await login();
            await agent
                .delete(`/api/workspaces/${libraryId}/content/test_tag`)
                .expect(200);
            const list = await agent.get('/api/workspaces').expect(200);
            const consumer = (
                list.body as { id: string; sharedContent: SharedGrantView[] }[]
            ).find((workspace) => workspace.id === consumerId);
            expect(consumer?.sharedContent[0].available).toBe(false);
        });

        it('cascades when the source workspace is deleted', async () => {
            await seedSharedContentGrants(consumerId, brandId, ['test_tag']);
            await getPool().query('DELETE FROM workspaces WHERE id = $1', [
                brandId
            ]);
            expect(
                (await grantRows(consumerId)).map((row) => row.slug)
            ).toEqual(['test_article']);
        });
    });

    describe('POST /api/workspaces with content.sharedContent', () => {
        function body(content: Record<string, unknown>) {
            return {
                name: 'New team',
                slug: 'new-team',
                description: '',
                color: 'slate',
                members: [],
                content
            };
        }

        it('creates own grants from the selection and shared grants beside them', async () => {
            const agent = await login();
            const res = await agent
                .post('/api/workspaces')
                .send(
                    body({
                        mode: 'specific',
                        collections: {
                            mode: 'specific',
                            ids: ['test_article']
                        },
                        sharedContent: [
                            { slug: 'test_tag', sourceWorkspaceId: libraryId },
                            {
                                slug: 'test_author',
                                sourceWorkspaceId: libraryId
                            }
                        ]
                    })
                )
                .expect(201);

            expect(res.body.content).toEqual(['test_article']);
            expect(
                (res.body.sharedContent as SharedGrantView[]).map(
                    (grant) => `${grant.slug}:${grant.sourceWorkspaceName}`
                )
            ).toEqual(['test_author:Library', 'test_tag:Library']);
        });

        it('"all" means every own type and no shared grant', async () => {
            const agent = await login();
            const res = await agent
                .post('/api/workspaces')
                .send(body({ mode: 'all' }))
                .expect(201);
            expect(res.body.content).toContain('test_tag');
            expect(res.body.sharedContent).toEqual([]);
        });

        it('422s an ineligible source and creates nothing', async () => {
            const agent = await login();
            await agent
                .post('/api/workspaces')
                .send(
                    body({
                        mode: 'all',
                        sharedContent: [
                            { slug: 'test_tag', sourceWorkspaceId: privateId }
                        ]
                    })
                )
                .expect(422);
            const { rows } = await getPool().query(
                "SELECT 1 FROM workspaces WHERE slug = 'new-team'"
            );
            expect(rows).toHaveLength(0);
        });

        it('400s a malformed item', async () => {
            const agent = await login();
            await agent
                .post('/api/workspaces')
                .send(
                    body({
                        mode: 'all',
                        sharedContent: [
                            { slug: 'test_tag', sourceWorkspaceId: 1 }
                        ]
                    })
                )
                .expect(400);
        });
    });

    describe('the migration backfill', () => {
        it('turns every implicit exposure into an explicit shared grant, and nothing more', async () => {
            // The pre-migration shape: own grants only. The consumer owns
            // `test_tag` and `test_author`; Library and Brand are shared and
            // own `test_tag`, Private owns it but is not shared, Archived is
            // shared but archived. Library alone also owns `test_author`.
            await seedContentGrants(consumerId, ['test_tag', 'test_author']);

            await runSharedGrantsBackfill();

            expect(
                (await grantRows(consumerId)).map((row) => [
                    row.slug,
                    row.source_workspace_id
                ])
            ).toEqual([
                ['test_article', null],
                ['test_author', null],
                ['test_author', libraryId],
                ['test_tag', null],
                ...[brandId, libraryId]
                    .sort()
                    .map((id) => ['test_tag', id] as [string, string])
            ]);
            // Every workspace owning a type read it from every shared, active
            // one — shared workspaces included, Private (unshared itself)
            // included — and nobody reads from Private or Archived.
            expect(
                (await grantRows(libraryId))
                    .filter((row) => row.source_workspace_id)
                    .map((row) => [row.slug, row.source_workspace_id])
            ).toEqual([['test_tag', brandId]]);
            expect(
                (await grantRows(privateId)).map(
                    (row) => row.source_workspace_id
                )
            ).toEqual([null, ...[brandId, libraryId].sort()]);
            const { rows } = await getPool().query(
                'SELECT 1 FROM workspace_content WHERE source_workspace_id = ANY($1)',
                [[privateId, archivedId]]
            );
            expect(rows).toHaveLength(0);

            // Idempotent, like the migration statement itself.
            await runSharedGrantsBackfill();
            expect(await grantRows(consumerId)).toHaveLength(6);
        });
    });
});
