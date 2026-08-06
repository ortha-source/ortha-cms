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
    seedContentGrants,
    seedLanding,
    seedPages,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'public-api-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** Shape of one item in the public list envelope (only the asserted bits). */
interface PublicItem {
    id: string;
    publishedAt?: string | null;
    values: Record<string, unknown>;
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

        it('returns a flat entry: no relations, no workspace, no status', async () => {
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
            // Column-backed fields ride `values`, including a single relation's
            // raw FK; join-backed ones (`tags`) are absent.
            expect(item.values).toHaveProperty('text');
            expect(item.values).toHaveProperty('author');
            expect(item.values).not.toHaveProperty('tags');
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
