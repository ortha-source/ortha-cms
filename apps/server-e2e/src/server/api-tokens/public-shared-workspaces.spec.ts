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
    seedAllSharedContentGrants,
    seedArticleTags,
    seedArticles,
    seedMembership,
    seedTags,
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'public-shared-admin@example.com';
const PASSWORD = 'SecurePass123!';

/** Published-now columns for a seeded row. */
const PUBLISHED = { status: 'published', publishedAt: new Date() } as const;

/** One public entry, as far as these tests read it. */
interface PublicItem {
    id: string;
    values: Record<string, unknown>;
    relations?: Record<string, { items: PublicItem[]; total: number }>;
}

/** The GraphQL-over-HTTP envelope, as far as these tests read it. */
interface GraphqlBody {
    data?: Record<string, unknown>;
    errors?: { message: string }[];
}

/**
 * **Shared workspaces** (ADR-0019) on the public content API — REST and
 * GraphQL.
 *
 * A consumer's published article linking a shared workspace's published tag
 * must expand that tag on both protocols, exactly as it expands an own one;
 * a shared **draft** must stay out of both `items` and `total`; and the
 * top-level list of a type must stay the consumer's own rows — sharing widens
 * what a record may point at, not what a workspace's API lists.
 */
describe('Shared workspaces (public REST + GraphQL)', () => {
    let harness: TestApp;
    let consumerId: string;
    let sharedId: string;
    let articleId: string;
    let sharedTag: string;
    let sharedDraftTag: string;
    /** A published article in the shared workspace. */
    let sharedArticle: string;

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
        for (const id of [consumerId, sharedId]) {
            await seedMembership(admin.id, id);
            await seedAllContentGrants(id);
        }
        // Explicit per-source grants (ADR-0019): the consumer reads the shared
        // workspace's records through shared grants of every type.
        await seedAllSharedContentGrants(consumerId, sharedId);
        [sharedTag, sharedDraftTag] = await seedTags(
            [{ name: 'Shared Design', ...PUBLISHED }, { name: 'Shared Draft' }],
            sharedId
        );
        [articleId] = await seedArticles(
            [{ text: 'Consumer article', select: 'article', ...PUBLISHED }],
            consumerId
        );
        await seedArticleTags(articleId, [sharedTag, sharedDraftTag]);
        // A published article in the shared workspace, linked to the same tag
        // — the inverse side a nested GraphQL read walks back through.
        [sharedArticle] = await seedArticles(
            [{ text: 'Library article', select: 'article', ...PUBLISHED }],
            sharedId
        );
        await seedArticleTags(sharedArticle, [sharedTag]);
    });

    /** Mints a read token for the consumer workspace and returns its secret. */
    async function consumerToken(): Promise<string> {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        const res = await agent
            .post('/api/api-tokens')
            .send({ name: 'e2e', workspaceIds: [consumerId], scope: 'read' })
            .expect(201);
        return res.body.secret as string;
    }

    it('expands a visible shared target on the REST preview, draft excluded from items and total [content:I-41]', async () => {
        const secret = await consumerToken();
        const res = await request(harness.server)
            .get('/api/v1/content/test_article')
            .query({ relations: 'preview', relationFields: 'tags' })
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);

        const items = res.body.items as PublicItem[];
        const article = items.find((item) => item.id === articleId);
        expect(article?.relations?.['tags'].total).toBe(1);
        expect(
            article?.relations?.['tags'].items.map((tag) => tag.values['name'])
        ).toEqual(['Shared Design']);
    });

    it('serves the union of visible sources on the top-level public list and entry reads, drafts excluded [content:I-45]', async () => {
        // Explicit per-source grants (ADR-0019): a type's public listing is
        // own records plus the published records of every source the
        // workspace holds a shared grant of the type for.
        const secret = await consumerToken();
        const tags = await request(harness.server)
            .get('/api/v1/content/test_tag')
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);
        expect(tags.body.total).toBe(1);
        expect((tags.body.items as PublicItem[]).map((t) => t.id)).toEqual([
            sharedTag
        ]);
        // `source` is not part of the public wire.
        expect(tags.body.items[0]).not.toHaveProperty('source');

        const articles = await request(harness.server)
            .get('/api/v1/content/test_article')
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);
        expect(
            (articles.body.items as PublicItem[]).map((a) => a.id).sort()
        ).toEqual([articleId, sharedArticle].sort());

        await request(harness.server)
            .get(`/api/v1/content/test_tag/${sharedTag}`)
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);
        await request(harness.server)
            .get(`/api/v1/content/test_tag/${sharedDraftTag}`)
            .set('Authorization', `Bearer ${secret}`)
            .expect(404);
    });

    it('resolves a shared target in a nested GraphQL relation, and one level deeper [content:I-41]', async () => {
        const secret = await consumerToken();
        const res = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({
                query: '{ testArticles(pageSize: 5) { items { text tags(pageSize: 5) { total items { name articles(pageSize: 5) { total items { text } } } } } } }'
            })
            .expect(200);
        const body = res.body as GraphqlBody;
        expect(body.errors).toBeUndefined();

        const [article] = (
            body.data?.['testArticles'] as {
                items: {
                    text: string;
                    tags: {
                        total: number;
                        items: {
                            name: string;
                            articles: {
                                total: number;
                                items: { text: string }[];
                            };
                        }[];
                    };
                }[];
            }
        ).items;
        expect(article.tags.total).toBe(1);
        expect(article.tags.items[0].name).toBe('Shared Design');
        // Level two — the shared tag re-read through the loader: its inverse
        // links resolve under the consumer's visibility, so both the
        // consumer's own article and the library's published one appear.
        expect(
            article.tags.items[0].articles.items.map((a) => a.text).sort()
        ).toEqual(['Consumer article', 'Library article']);
    });

    it('hides the shared target everywhere once the workspace is unshared [content:I-44]', async () => {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        await agent
            .patch(`/api/workspaces/${sharedId}`)
            .send({ isShared: false })
            .expect(200);

        const secret = await consumerToken();
        const rest = await request(harness.server)
            .get('/api/v1/content/test_article')
            .query({ relations: 'preview', relationFields: 'tags' })
            .set('Authorization', `Bearer ${secret}`)
            .expect(200);
        expect(
            (rest.body.items as PublicItem[])[0].relations?.['tags']
        ).toEqual({ items: [], total: 0 });

        const gql = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({ query: '{ testArticles { items { tags { total } } } }' })
            .expect(200);
        expect((gql.body as GraphqlBody).data?.['testArticles']).toEqual({
            items: [{ tags: { total: 0 } }]
        });
    });
});
