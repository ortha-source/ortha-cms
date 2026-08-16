import { getIntrospectionQuery } from 'graphql';
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
                maxFields: 8,
                // Roomy enough for the standard introspection query (~1.9 KB)
                // and the fragment-bomb fixture; the length test pads past it.
                maxQueryLength: 4096
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
            `{ testArticles { total } }\n# ${'x'.repeat(4100)}`
        );

        expect(errors[0]?.message).toMatch(/characters; the limit is 4096/);
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

    it('costs a fragment bomb in linear time instead of hanging', async () => {
        // `{ ...F0 }` with F0…F8 each spreading the next ten times: 10^9
        // expansions in under 800 bytes, well inside any length limit. Costing
        // that un-memoised blocked the event loop for minutes — every request
        // on the process, not just this one — so the assertion that matters is
        // that the answer arrives at all.
        const width = 10;
        const spread = (name: string) =>
            Array.from({ length: width }, () => `...${name}`).join(' ');
        let query = `{ ${spread('F0')} }\n`;
        for (let level = 0; level < 9; level++) {
            query +=
                `fragment F${level} on Query { ` +
                (level === 8
                    ? 'testArticles { total }'
                    : spread(`F${level + 1}`)) +
                ' }\n';
        }

        const started = Date.now();
        const errors = await errorsFor(query);

        expect(Date.now() - started).toBeLessThan(2000);
        expect(errors[0]?.extensions?.code).toBe('GRAPHQL_LIMIT_EXCEEDED');
    });

    it('costs a page size that comes from a variable default', async () => {
        // The value graphql-js substitutes when the caller sends nothing.
        // Reading only the supplied variables let the whole budget be defeated
        // by moving the number one token to the left.
        const res = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({
                query: 'query Q($n: Int = 100) { testArticles(pageSize: $n) { items { text } } }'
            })
            .expect(200);

        expect(
            (res.body.errors ?? []).map(
                (error: { message: string }) => error.message
            )
        ).toContainEqual(expect.stringMatching(/may touch about/));
    });

    it('lets the standard introspection query through', async () => {
        // Introspection is deliberately enabled and is answered from the schema
        // already in memory. Costing it as content refused it outright at these
        // limits — and at the shipped defaults — which is GraphiQL and every
        // codegen tool locked out of an endpoint that advertises them.
        const res = await request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({ query: getIntrospectionQuery() })
            .expect(200);

        expect(res.body.errors).toBeUndefined();
        expect(res.body.data.__schema.types.length).toBeGreaterThan(0);
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
