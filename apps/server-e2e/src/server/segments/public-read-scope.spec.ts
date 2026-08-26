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
    seedMembership,
    seedTags,
    seedWorkspace,
    type SeededUser
} from '../../support/seed';
import {
    READER_TAGS_HEADER,
    reloadSegmentCatalogue
} from '../../support/segments';

const ADMIN = 'read-scope-admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * Reader entitlements on the **public** content API.
 *
 * The kernel's spec says the three rules are right; this says the database
 * agrees — the predicate is `canRead` in SQL, and the only way to know it stayed
 * that way is to run it. It also pins the half a unit test cannot reach at all:
 * a relation's `total` must not count links the reader cannot follow.
 */
describe('Public reads, scoped by segment (/api/v1)', () => {
    let harness: TestApp;
    let admin: SeededUser;
    let workspaceId: string;
    let acme: string;
    let globex: string;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        await reloadSegmentCatalogue(harness.app);
        admin = await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS', slug: 'ws' })).id;
        // `WorkspaceGuard` 403s a non-member, and setting an entry's access is
        // workspace-scoped — without this the suite fails in its own seed.
        await seedMembership(admin.id, workspaceId);
        await seedContentGrants(workspaceId, ['test_article', 'test_tag']);

        const agent = await login();
        acme = await createSegment(agent, 'acme', 'Acme');
        globex = await createSegment(agent, 'globex', 'Globex');
    });

    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function createSegment(
        agent: request.Agent,
        key: string,
        label: string
    ): Promise<string> {
        const response = await agent
            .post('/api/segments')
            .send({ key, label })
            .expect(201);
        return response.body.id as string;
    }

    /** A read-scoped bearer token for the workspace. */
    async function mintToken(): Promise<string> {
        const agent = await login();
        const response = await agent
            .post('/api/api-tokens')
            .send({ name: 'e2e', workspaceIds: [workspaceId], scope: 'read' })
            .expect(201);
        return response.body.secret as string;
    }

    /** One published article. */
    async function seedPublished(text: string): Promise<string> {
        const [id] = await seedArticles(
            [
                {
                    text,
                    select: 'article',
                    status: 'published',
                    publishedAt: new Date()
                }
            ],
            workspaceId
        );
        return id;
    }

    /** Set one entry's access through the entry's own save. */
    async function restrict(
        entryId: string,
        access: { allow?: string[]; deny?: string[] }
    ): Promise<void> {
        const agent = await login();
        await agent
            .put(`/api/segments/entries/${entryId}`)
            .send({
                typeSlug: 'test_article',
                allow: access.allow ?? [],
                deny: access.deny ?? []
            })
            .expect(200);
    }

    /** A public list read as a reader carrying `tags`. */
    async function readAs(
        token: string,
        tags: string[],
        path = '/api/v1/content/test_article'
    ) {
        const call = request(harness.server)
            .get(path)
            .set('Authorization', `Bearer ${token}`);
        if (tags.length) call.set(READER_TAGS_HEADER, tags.join(','));
        return call.expect(200);
    }

    describe('the three rules', () => {
        it('serves an unrestricted entry to the anonymous reader', async () => {
            // The state every entry starts in, and the first thing to keep
            // true: installing the plugin changes nothing.
            await seedPublished('Open');
            const token = await mintToken();

            const response = await readAs(token, []);
            expect(response.body.total).toBe(1);
        });

        it('hides a restricted entry from a reader in no segment', async () => {
            const id = await seedPublished('Members only');
            await restrict(id, { allow: [acme] });
            const token = await mintToken();

            const response = await readAs(token, []);
            expect(response.body.total).toBe(0);
        });

        it('serves it to a reader whose tag resolves to an allowed segment', async () => {
            const id = await seedPublished('Members only');
            await restrict(id, { allow: [acme] });
            const token = await mintToken();

            const response = await readAs(token, ['acme']);
            expect(response.body.total).toBe(1);
        });

        it('lets a deny win over an allow', async () => {
            // Reversed, "everyone in Europe except this customer" would be
            // unsayable.
            const id = await seedPublished('Not for Acme');
            await restrict(id, { allow: [acme, globex], deny: [acme] });
            const token = await mintToken();

            await expect(
                readAs(token, ['acme']).then((r) => r.body.total)
            ).resolves.toBe(0);
            await expect(
                readAs(token, ['globex']).then((r) => r.body.total)
            ).resolves.toBe(1);
        });

        it('reads an empty allow list as everyone, not nobody', async () => {
            // The two emptinesses look alike and are opposite. Reading this one
            // as a closed door would black out a library on install.
            const id = await seedPublished('Open, but not to Globex');
            await restrict(id, { deny: [globex] });
            const token = await mintToken();

            await expect(
                readAs(token, []).then((r) => r.body.total)
            ).resolves.toBe(1);
            await expect(
                readAs(token, ['globex']).then((r) => r.body.total)
            ).resolves.toBe(0);
        });

        it('matches any one of a segment’s tags', async () => {
            const agent = await login();
            const plan = (
                await agent
                    .post('/api/segments')
                    .send({
                        key: 'plan',
                        label: 'Plan',
                        tags: ['plan-pro', 'plan-legacy']
                    })
                    .expect(201)
            ).body.id as string;
            const id = await seedPublished('Pro only');
            await restrict(id, { allow: [plan] });
            const token = await mintToken();

            for (const tag of ['plan-pro', 'plan-legacy']) {
                await expect(
                    readAs(token, [tag]).then((r) => r.body.total)
                ).resolves.toBe(1);
            }
            await expect(
                readAs(token, ['plan-basic']).then((r) => r.body.total)
            ).resolves.toBe(0);
        });

        it('hides a restricted entry from the single-entry read too', async () => {
            // The scope lives in `liveWhere`, so it cannot be missed by a read
            // that chose the narrower helper.
            const id = await seedPublished('Members only');
            await restrict(id, { allow: [acme] });
            const token = await mintToken();

            await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(404);

            await request(harness.server)
                .get(`/api/v1/content/test_article/${id}`)
                .set('Authorization', `Bearer ${token}`)
                .set(READER_TAGS_HEADER, 'acme')
                .expect(200);
        });
    });

    describe('relations', () => {
        /** An article linked to two published tags, one of them restricted. */
        async function seedLinked() {
            const articleId = await seedPublished('Has tags');
            const tagIds = await seedTags(
                [
                    { name: 'Open tag', status: 'published' },
                    { name: 'Secret tag', status: 'published' }
                ],
                workspaceId
            );
            await seedArticleTags(articleId, tagIds);
            const agent = await login();
            await agent
                .put(`/api/segments/entries/${tagIds[1]}`)
                .send({ typeSlug: 'test_tag', allow: [acme], deny: [] })
                .expect(200);
            return { articleId, tagIds };
        }

        it('drops a target the reader cannot see from BOTH items and total', async () => {
            // The half that leaked: `items` was filtered at hydration while
            // `total` still counted the link, so "2 links, 1 visible" told the
            // reader a restricted record existed there.
            const { articleId } = await seedLinked();
            const token = await mintToken();

            const response = await request(harness.server)
                .get(`/api/v1/content/test_article/${articleId}`)
                .query({ relations: 'preview', relationFields: 'tags' })
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(response.body.relations.tags.items).toHaveLength(1);
            expect(response.body.relations.tags.total).toBe(1);
        });

        it('counts both for a reader who may see both', async () => {
            const { articleId } = await seedLinked();
            const token = await mintToken();

            const response = await request(harness.server)
                .get(`/api/v1/content/test_article/${articleId}`)
                .query({ relations: 'preview', relationFields: 'tags' })
                .set('Authorization', `Bearer ${token}`)
                .set(READER_TAGS_HEADER, 'acme')
                .expect(200);

            expect(response.body.relations.tags.items).toHaveLength(2);
            expect(response.body.relations.tags.total).toBe(2);
        });

        it('applies the same rule to the per-field relation route', async () => {
            // A different entry point, the same predicate — `relationField`
            // hydrates through the shared path.
            const { articleId } = await seedLinked();
            const token = await mintToken();

            const hidden = await request(harness.server)
                .get(`/api/v1/content/test_article/${articleId}/relations/tags`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            expect(hidden.body.total).toBe(1);
            expect(hidden.body.items).toHaveLength(1);

            const visible = await request(harness.server)
                .get(`/api/v1/content/test_article/${articleId}/relations/tags`)
                .set('Authorization', `Bearer ${token}`)
                .set(READER_TAGS_HEADER, 'acme')
                .expect(200);
            expect(visible.body.total).toBe(2);
        });

        it('leaves the admin’s own relation read untouched', async () => {
            // An editor must see the records their entry links to in order to
            // manage them, including ones no reader may fetch.
            const { articleId } = await seedLinked();
            const agent = await login();

            const response = await agent
                .get(`/api/content/test_article/${articleId}/relations/tags`)
                .expect(200);
            expect(response.body.total).toBe(2);
        });
    });

    describe('when nothing is configured', () => {
        it('serves exactly what it did before the plugin existed', async () => {
            // With no segment the catalogue is empty, the scope returns
            // `undefined`, and no fragment is emitted.
            const agent = await login();
            for (const id of [acme, globex]) {
                await agent.delete(`/api/segments/${id}`).expect(204);
            }
            await seedPublished('Open');
            const token = await mintToken();

            const response = await readAs(token, []);
            expect(response.body.total).toBe(1);
        });
    });
});
