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
    seedWorkspace
} from '../../support/seed';
import { reloadSegmentCatalogue } from '../../support/segments';

const ADMIN = 'agent-access-admin@example.com';
const PASSWORD = 'SecurePass123!';
const MCP_PATH = '/api/v1/mcp';
const ACCEPT = 'application/json, text/event-stream';

/** One JSON-RPC envelope, as the endpoint answers it. */
interface RpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: unknown;
}

/** One MCP tool, as `tools/list` returns it. */
interface McpTool {
    name: string;
}

/**
 * Reader entitlements over the **agent-facing** surfaces — the MCP tool
 * catalogue and the token-authenticated REST route.
 *
 * The point of the suite is the seam rather than the rules: `canRead` and the
 * locale-group write are covered against the admin API elsewhere, and everything
 * here goes through the same `EntryAccessService`. What only these calls can
 * show is that a **token** reaches them at all — the scope mapping, the tool
 * catalogue's read/write split, and the grant gate on the public route.
 */
describe('Segments over MCP and the public API', () => {
    let harness: TestApp;
    let workspaceId: string;
    let otherWorkspaceId: string;
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
        await seedActiveUser(harness.app, {
            email: ADMIN,
            password: PASSWORD,
            role: 'admin'
        });
        workspaceId = (await seedWorkspace({ name: 'WS A', slug: 'ws-a' })).id;
        otherWorkspaceId = (await seedWorkspace({ name: 'WS B', slug: 'ws-b' }))
            .id;
        // `test_page` is left ungranted, so the grant gate has something to hide.
        await seedContentGrants(workspaceId, ['test_article']);
        await seedContentGrants(otherWorkspaceId, ['test_article']);

        const agent = await login();
        acme = await createSegment(agent, 'acme', 'Acme');
        globex = await createSegment(agent, 'globex', 'Globex');
    });

    /** Logs in as the admin and returns a cookie-bearing agent. */
    async function login() {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Creates one audience through the admin API, returning its id. */
    async function createSegment(
        agent: request.Agent,
        key: string,
        label: string,
        workspaceIds?: string[]
    ): Promise<string> {
        const response = await agent
            .post('/api/segments')
            .send({ key, label, ...(workspaceIds ? { workspaceIds } : {}) })
            .expect(201);
        return response.body.id as string;
    }

    /** Mints a token through the real management API. */
    async function mintToken(
        options: { workspaceIds?: string[]; scope?: 'read' | 'full' } = {}
    ): Promise<string> {
        const agent = await login();
        const response = await agent
            .post('/api/api-tokens')
            .send({
                name: 'agent-access-e2e',
                workspaceIds: options.workspaceIds ?? [workspaceId],
                scope: options.scope ?? 'read'
            })
            .expect(201);
        return response.body.secret as string;
    }

    let nextId = 1;

    /** One JSON-RPC request with a bearer token. */
    function rpc(
        secret: string,
        method: string,
        params?: Record<string, unknown>,
        options: { workspaceId?: string } = {}
    ) {
        const call = request(harness.server)
            .post(MCP_PATH)
            .set('Authorization', `Bearer ${secret}`)
            .set('Accept', ACCEPT)
            .set('Content-Type', 'application/json');
        if (options.workspaceId) {
            call.set('X-Workspace-Id', options.workspaceId);
        }
        return call.send({
            jsonrpc: '2.0',
            id: nextId++,
            method,
            ...(params ? { params } : {})
        });
    }

    /** Every tool name a token is offered. */
    async function toolNames(secret: string): Promise<string[]> {
        const response = await rpc(secret, 'tools/list').expect(200);
        const result = (response.body as RpcResponse).result as {
            tools: McpTool[];
        };
        return result.tools.map((tool) => tool.name);
    }

    /** Calls one tool and returns its parsed payload. */
    async function callTool(
        secret: string,
        name: string,
        args: Record<string, unknown> = {}
    ) {
        const response = await rpc(secret, 'tools/call', {
            name,
            arguments: args
        }).expect(200);
        const result = (response.body as RpcResponse).result as {
            isError?: boolean;
            content: { type: string; text: string }[];
        };
        return {
            isError: result.isError === true,
            data: JSON.parse(result.content[0].text) as Record<string, unknown>
        };
    }

    /** One published article, returning its id. */
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

    describe('the tool catalogue', () => {
        it('offers a read token the two reads and not the write', async () => {
            // The scope mapping is the gate, and it is the reason these tools
            // are reachable at all: neither `read` nor `full` carried a
            // `segments:*` key before, so a tool declaring one was offered to
            // nobody.
            const names = await toolNames(await mintToken({ scope: 'read' }));

            expect(names).toContain('segments_list');
            expect(names).toContain('content_access_get');
            expect(names).not.toContain('content_access_set');
        });

        it('offers a full token the write as well', async () => {
            const names = await toolNames(await mintToken({ scope: 'full' }));

            expect(names).toContain('content_access_set');
        });

        it('offers no tool over the audience directory, at any scope', async () => {
            // Deliberate: renaming one audience's tags changes who every entry
            // naming it is visible to, installation-wide. That is administration
            // of the vocabulary and stays on a screen where a person reads the
            // consequence — so `segments:manage` on a token reaches entry access
            // and nothing else.
            const names = await toolNames(await mintToken({ scope: 'full' }));

            for (const name of names) {
                expect(name).not.toMatch(
                    /^segments_(create|update|delete|set)$/
                );
            }
        });

        it('shows no copilot-only tool, whatever the scope', async () => {
            const names = await toolNames(await mintToken({ scope: 'full' }));

            expect(names).not.toContain('content_propose_access');
        });
    });

    describe('segments_list', () => {
        it('lists the audiences this workspace may decide against', async () => {
            const secret = await mintToken({ scope: 'read' });

            const { data } = await callTool(secret, 'segments_list');
            const segments = data['segments'] as { id: string; key: string }[];

            expect(segments.map((s) => s.key).sort()).toEqual([
                'acme',
                'globex'
            ]);
        });

        it('omits an audience offered only elsewhere', async () => {
            // Offering one the write then refuses would be offering a choice
            // that cannot be made.
            const admin = await login();
            await createSegment(admin, 'elsewhere', 'Elsewhere', [
                otherWorkspaceId
            ]);
            const secret = await mintToken({ scope: 'read' });

            const { data } = await callTool(secret, 'segments_list');
            const segments = data['segments'] as { key: string }[];

            expect(segments.map((s) => s.key)).not.toContain('elsewhere');
        });
    });

    describe('content_access_get / _set', () => {
        it('reads an unrestricted entry as open', async () => {
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'read' });

            const { data } = await callTool(secret, 'content_access_get', {
                entryId
            });

            expect(data['restricted']).toBe(false);
            expect(data['allow']).toEqual([]);
        });

        it('refuses the write to a read token', async () => {
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'read' });

            const { isError } = await callTool(secret, 'content_access_set', {
                entryId,
                typeName: 'test_article',
                allow: [acme],
                deny: []
            });

            expect(isError).toBe(true);
        });

        it('writes, and reads back the audiences by name', async () => {
            // Named rather than identified: an agent reasoning about "who can
            // see the pricing page" cannot do anything with two uuids.
            const entryId = await seedPublished('Restricted');
            const secret = await mintToken({ scope: 'full' });

            const written = await callTool(secret, 'content_access_set', {
                entryId,
                typeName: 'test_article',
                allow: [acme],
                deny: [globex]
            });
            expect(written.isError).toBe(false);

            const { data } = await callTool(secret, 'content_access_get', {
                entryId
            });
            expect(data['restricted']).toBe(true);
            expect(
                (data['allow'] as { label: string }[]).map((s) => s.label)
            ).toEqual(['Acme']);
            expect(
                (data['deny'] as { label: string }[]).map((s) => s.label)
            ).toEqual(['Globex']);
        });

        it('reads back what it just restricted', async () => {
            // The reason `content_access_get` answers from the access table
            // rather than through the public entry read: that read is
            // reader-scoped, so the restriction the agent just wrote would be
            // the thing hiding the answer from it.
            const entryId = await seedPublished('Restricted');
            const secret = await mintToken({ scope: 'full' });

            await callTool(secret, 'content_access_set', {
                entryId,
                typeName: 'test_article',
                allow: [acme],
                deny: []
            });

            const { isError, data } = await callTool(
                secret,
                'content_access_get',
                { entryId }
            );
            expect(isError).toBe(false);
            expect(data['restricted']).toBe(true);
        });

        it('opens an entry back up with two empty lists', async () => {
            const entryId = await seedPublished('Was restricted');
            const secret = await mintToken({ scope: 'full' });

            await callTool(secret, 'content_access_set', {
                entryId,
                typeName: 'test_article',
                allow: [acme],
                deny: []
            });
            await callTool(secret, 'content_access_set', {
                entryId,
                typeName: 'test_article',
                allow: [],
                deny: []
            });

            const { data } = await callTool(secret, 'content_access_get', {
                entryId
            });
            expect(data['restricted']).toBe(false);
        });

        it('refuses a content type nothing serves', async () => {
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'full' });

            const { isError } = await callTool(secret, 'content_access_set', {
                entryId,
                typeName: 'not_a_type',
                allow: [acme],
                deny: []
            });

            expect(isError).toBe(true);
        });
    });

    describe('the public REST route', () => {
        /** `GET|PUT /api/v1/content/test_article/:id/access`. */
        const path = (id: string) =>
            `/api/v1/content/test_article/${id}/access`;

        it('answers a read token', async () => {
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'read' });

            const response = await request(harness.server)
                .get(path(entryId))
                .set('Authorization', `Bearer ${secret}`)
                .expect(200);

            expect(response.body).toEqual({
                entryId,
                restricted: false,
                allow: [],
                deny: []
            });
        });

        it('403s a read token on the write', async () => {
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'read' });

            await request(harness.server)
                .put(path(entryId))
                .set('Authorization', `Bearer ${secret}`)
                .send({ allow: [acme], deny: [] })
                .expect(403);
        });

        it('writes for a full token, and answers the stored lists', async () => {
            const entryId = await seedPublished('Restricted');
            const secret = await mintToken({ scope: 'full' });

            const written = await request(harness.server)
                .put(path(entryId))
                .set('Authorization', `Bearer ${secret}`)
                .send({ allow: [acme], deny: [globex] })
                .expect(200);

            expect(written.body).toEqual({
                entryId,
                restricted: true,
                allow: [acme],
                deny: [globex]
            });
        });

        it('401s without a token', async () => {
            const entryId = await seedPublished('Open');

            await request(harness.server).get(path(entryId)).expect(401);
        });

        it('400s a type the workspace was not granted', async () => {
            // The same answer an unknown type gets, so a client cannot learn the
            // installation's type list by probing.
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'read' });

            await request(harness.server)
                .get(`/api/v1/content/test_page/${entryId}/access`)
                .set('Authorization', `Bearer ${secret}`)
                .expect(400);
        });

        it('403s a workspace outside the token’s bucket', async () => {
            const entryId = await seedPublished('Open');
            const secret = await mintToken({
                scope: 'read',
                workspaceIds: [workspaceId]
            });

            await request(harness.server)
                .get(path(entryId))
                .set('Authorization', `Bearer ${secret}`)
                .set('X-Workspace-Id', otherWorkspaceId)
                .expect(403);
        });

        it('refuses an audience this workspace was not offered', async () => {
            const admin = await login();
            const elsewhere = await createSegment(
                admin,
                'elsewhere',
                'Elsewhere',
                [otherWorkspaceId]
            );
            const entryId = await seedPublished('Open');
            const secret = await mintToken({ scope: 'full' });

            await request(harness.server)
                .put(path(entryId))
                .set('Authorization', `Bearer ${secret}`)
                .send({ allow: [elsewhere], deny: [] })
                .expect(400);
        });
    });
});
