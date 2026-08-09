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
    seedWorkspace
} from '../../support/seed';

const ADMIN_EMAIL = 'graphql-limits-admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The GraphQL endpoint's **cost budget**.
 *
 * A dedicated app with the limits pinned tight, so a refusal is deterministic
 * without having to author a genuinely enormous document — the same arrangement
 * as the login-throttle suite, and for the same reason: a second app inside
 * another suite would end the shared per-file connection pool.
 *
 * REST bounded a request structurally (one route, one page, `MAX_PAGE_SIZE`);
 * a GraphQL document does not, so these limits are the replacement bound and
 * are worth pinning.
 */
describe('Public GraphQL API cost limits (/api/v1/graphql)', () => {
    let harness: TestApp;
    let workspaceId: string;
    let secret: string;

    beforeAll(async () => {
        harness = await createTestApp({
            graphqlLimits: {
                maxDepth: 3,
                maxComplexity: 50,
                maxAliases: 8,
                maxQueryLength: 200
            }
        });
        await resetDb();
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS L', slug: 'ws-l' })).id;
        await seedContentGrants(workspaceId, ['test_article', 'test_tag']);

        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        const minted = await agent
            .post('/api/api-tokens')
            .send({
                name: 'e2e-limits',
                workspaceIds: [workspaceId],
                scope: 'read'
            })
            .expect(201);
        secret = minted.body.secret as string;
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    /** Runs one operation and returns its errors, if any. */
    async function errorsFor(
        query: string
    ): Promise<{ message: string; extensions?: { code?: string } }[]> {
        const res = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({ query })
            .expect(200);
        return res.body.errors ?? [];
    }

    it('accepts a query inside every budget', async () => {
        expect(await errorsFor('{ testArticles { total } }')).toEqual([]);
    });

    it('refuses a query nested past the depth limit', async () => {
        const errors = await errorsFor(
            '{ testArticles { items { tags { items { label } } } } }'
        );

        expect(errors[0]?.extensions?.code).toBe('GRAPHQL_LIMIT_EXCEEDED');
        expect(errors.map((error) => error.message)).toContainEqual(
            expect.stringMatching(/levels deep/)
        );
    });

    it('refuses a document longer than the length limit', async () => {
        // Padded with a comment rather than more fields, so this trips the
        // LENGTH limit specifically — the field cap is a separate test, and the
        // length check runs first precisely so an enormous document is refused
        // before it is parsed.
        const errors = await errorsFor(
            `{ testArticles { total } }\n# ${'x'.repeat(250)}`
        );

        expect(errors[0]?.message).toMatch(/characters; the limit is 200/);
    });

    it('refuses a document that aliases past the field limit', async () => {
        const aliased = Array.from(
            { length: 6 },
            (_, index) => `a${index}: testArticles { total }`
        ).join(' ');
        const errors = await errorsFor(`{ ${aliased} }`);

        expect(errors.map((error) => error.message)).toContainEqual(
            expect.stringMatching(/fields; the limit is 8/)
        );
    });

    it('refuses a shallow but expensive query on complexity', async () => {
        // Depth 3, so the depth cap alone would wave it straight through — this
        // is the limit that catches a wide page instead of a deep one.
        const errors = await errorsFor(
            '{ testArticles(pageSize: 100) { items { text } } }'
        );

        expect(errors.map((error) => error.message)).toContainEqual(
            expect.stringMatching(/may touch about/)
        );
    });

    it('refuses the query before executing it', async () => {
        // A refused document costs a parse and nothing else — no `data` key at
        // all, so no resolver ran and no query was issued.
        const res = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({
                query: '{ testArticles { items { tags { items { label } } } } }'
            })
            .expect(200);

        expect(res.body.data).toBeUndefined();
    });
});
