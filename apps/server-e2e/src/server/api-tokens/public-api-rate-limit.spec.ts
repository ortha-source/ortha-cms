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

const ADMIN_EMAIL = 'rate-limit-admin@example.com';
const PASSWORD = 'SecurePass123!';
const MCP_PATH = '/api/v1/mcp';
const ACCEPT_RPC = 'application/json, text/event-stream';

/** The budget this app is pinned to — small enough to spend in four requests. */
const LIMIT = 3;

/**
 * The public API's **per-token rate limit**, across all three protocols it is
 * served over.
 *
 * The gap this closes: a single `read` token could make three hundred
 * consecutive `POST /api/v1/graphql` calls and get three hundred 200s, and the
 * REST surface behaved identically. GraphQL's cost budget bounds one document
 * and says nothing about documents per second, so it was a per-request cost cap
 * standing in for a rate limit it never was.
 *
 * A dedicated app with the limit pinned to three, like the login-throttle suite
 * — the shipped 300 would take a minute of requests to reach and would make
 * every assertion here depend on what the test before it spent.
 *
 * **A fresh token per test rather than a fresh app per test.** The bucket is
 * keyed on the token id, so minting a token is minting a bucket; that keeps the
 * order-independence a per-test app would buy at a fraction of the cost, and it
 * is also the property the isolation test below asserts directly.
 */
describe('Public API rate limit (per API token)', () => {
    let harness: TestApp;
    let workspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp({
            apiTokenRateLimit: { ttlSeconds: 60, limit: LIMIT }
        });
        await resetDb();
        await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS R', slug: 'ws-r' })).id;
        await seedContentGrants(workspaceId, ['test_article']);
    });

    afterAll(async () => {
        await closeTestApp(harness);
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

    let minted = 0;

    /** Mints a token through the real management API — and with it, a bucket. */
    async function mintToken(scope: 'read' | 'full' = 'read'): Promise<string> {
        const agent = await login();
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: `rate-limit-e2e-${(minted += 1)}`,
                workspaceIds: [workspaceId],
                scope
            })
            .expect(201);
        return res.body.secret as string;
    }

    /** One REST read on the public content API. */
    const rest = (secret: string) =>
        request(harness.server)
            .get('/api/v1/content/test_article')
            .set('Authorization', `Bearer ${secret}`);

    /** One GraphQL read against the same content. */
    const graphql = (secret: string) =>
        request(harness.server)
            .post('/api/v1/graphql')
            .set('Authorization', `Bearer ${secret}`)
            .send({ query: '{ testArticles { total } }' });

    let nextRpcId = 1;

    /** One MCP JSON-RPC call. */
    const mcp = (secret: string) =>
        request(harness.server)
            .post(MCP_PATH)
            .set('Authorization', `Bearer ${secret}`)
            .set('Accept', ACCEPT_RPC)
            .set('Content-Type', 'application/json')
            .send({ jsonrpc: '2.0', id: nextRpcId++, method: 'tools/list' });

    describe('REST (/api/v1/*)', () => {
        it('serves the budget, then refuses with 429', async () => {
            const secret = await mintToken();

            for (let i = 0; i < LIMIT; i += 1) {
                await rest(secret).expect(200);
            }

            await rest(secret).expect(429);
        });

        it('tells a refused caller when to come back', async () => {
            const secret = await mintToken();
            for (let i = 0; i < LIMIT; i += 1) {
                await rest(secret).expect(200);
            }

            const refused = await rest(secret).expect(429);

            // `Retry-After` is what a well-behaved client actually backs off
            // on, and a 429 without one invites an immediate retry loop.
            expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
            expect(Number(refused.headers['retry-after'])).toBeLessThanOrEqual(
                60
            );
            expect(refused.headers['x-ratelimit-limit']).toBe(String(LIMIT));
            expect(refused.headers['x-ratelimit-remaining']).toBe('0');
            expect(refused.body.message).toContain('Rate limit exceeded');
        });

        it('advertises the remaining budget before the refusal, not only after', async () => {
            // A client that first learns its budget when it is refused has no
            // way to slow down in time, which is the point of publishing it.
            const secret = await mintToken();

            const first = await rest(secret).expect(200);
            const second = await rest(secret).expect(200);

            expect(first.headers['x-ratelimit-limit']).toBe(String(LIMIT));
            expect(first.headers['x-ratelimit-remaining']).toBe('2');
            expect(second.headers['x-ratelimit-remaining']).toBe('1');
            // Epoch seconds, so a client can compute the wait without guessing
            // at clock skew.
            expect(
                Number(first.headers['x-ratelimit-reset']) * 1000
            ).toBeGreaterThan(Date.now());
        });

        it('meters a write route the token’s scope forbids', async () => {
            // A `read` token looping on a write it can never perform costs the
            // server exactly as much as one doing legitimate work, so the
            // budget is spent before the permission check, not after.
            const secret = await mintToken('read');

            for (let i = 0; i < LIMIT; i += 1) {
                await request(harness.server)
                    .post('/api/v1/content/test_article')
                    .set('Authorization', `Bearer ${secret}`)
                    .send({ data: { title: 'nope' } })
                    .expect(403);
            }

            await rest(secret).expect(429);
        });
    });

    describe('GraphQL (POST /api/v1/graphql)', () => {
        it('refuses with a real 429, not a 200 carrying an error', async () => {
            // Everything a resolver raises travels in `errors` with the HTTP
            // status at 200 — but this refusal happens in the guard, before any
            // document is parsed, and a client throttling on `extensions.status`
            // inside a 200 body is a client that will not back off.
            const secret = await mintToken();
            for (let i = 0; i < LIMIT; i += 1) {
                await graphql(secret).expect(200);
            }

            const refused = await graphql(secret).expect(429);

            expect(refused.body.errors).toBeUndefined();
            expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
        });

        it('refuses the SDL route on the same budget', async () => {
            const secret = await mintToken();
            for (let i = 0; i < LIMIT; i += 1) {
                await graphql(secret).expect(200);
            }

            await request(harness.server)
                .get('/api/v1/graphql')
                .set('Authorization', `Bearer ${secret}`)
                .expect(429);
        });
    });

    describe('MCP (POST /api/v1/mcp)', () => {
        it('refuses with an HTTP 429 rather than a JSON-RPC error', async () => {
            // A transport-level answer is what tells a client to back off; a
            // JSON-RPC error reads as a working connection returning a failure
            // for the model to reason about — which is how a looping agent
            // turns a rate limit into a retry storm.
            const secret = await mintToken();
            for (let i = 0; i < LIMIT; i += 1) {
                await mcp(secret).expect(200);
            }

            const refused = await mcp(secret).expect(429);

            // A JSON-RPC envelope would carry `jsonrpc: '2.0'` and an `error`
            // OBJECT with a numeric code; this is Nest's HTTP error body.
            expect(refused.body.jsonrpc).toBeUndefined();
            expect(refused.body).toMatchObject({ statusCode: 429 });
            expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
        });
    });

    describe('one bucket per credential', () => {
        it('is shared by all three protocols', async () => {
            // The decision ORT-99 asked for: a token has ONE ceiling, not one
            // per front door — otherwise a caller trebles its budget by
            // spreading the same credential across REST, GraphQL and MCP.
            const secret = await mintToken();

            await rest(secret).expect(200);
            await graphql(secret).expect(200);
            await mcp(secret).expect(200);

            await rest(secret).expect(429);
            await graphql(secret).expect(429);
            await mcp(secret).expect(429);
        });

        it('does not spend another token’s budget', async () => {
            // The credential is the unit of fairness: one runaway integration
            // must not be able to refuse every other caller in the workspace,
            // which is precisely why the key is the token and not the tenant.
            const exhausted = await mintToken();
            const healthy = await mintToken();
            for (let i = 0; i < LIMIT; i += 1) {
                await rest(exhausted).expect(200);
            }
            await rest(exhausted).expect(429);

            await rest(healthy).expect(200);
        });

        it('is never allocated by a request that did not authenticate', async () => {
            // An unauthenticated flood must not be able to grow the bucket map
            // (there is no verified id to key it on) nor to exhaust anything —
            // it stays a flat 401, with no 429 to distinguish a real token from
            // an invented one.
            for (let i = 0; i < LIMIT * 3; i += 1) {
                await request(harness.server)
                    .get('/api/v1/content/test_article')
                    .set('Authorization', 'Bearer orthacms_not-a-real-token')
                    .expect(401);
            }

            const secret = await mintToken();
            await rest(secret).expect(200);
        });
    });

    describe('what it does not touch', () => {
        it('leaves the session-authenticated admin API alone', async () => {
            // This is a limit on a *credential minted for machines*, and the
            // admin UI makes far more requests than any of them. The session
            // routes have their own defences (the login throttle, RBAC); a
            // shared bucket here would throttle a person for browsing.
            const agent = await login();

            for (let i = 0; i < LIMIT * 3; i += 1) {
                await agent
                    .get('/api/content-types')
                    .set('X-Workspace-Id', workspaceId)
                    .expect(200);
            }
        });
    });
});
