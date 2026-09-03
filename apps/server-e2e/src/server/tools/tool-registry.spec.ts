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
    seedMembership,
    seedWorkspace,
    type SeededWorkspace
} from '../../support/seed';
import {
    copilotCalls,
    resetCopilot,
    scriptCopilot
} from '../../support/copilot';
import { parseSse } from '../../support/sse';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';

const ADMIN_EMAIL = 'tool-registry-admin@example.com';
const PASSWORD = 'SecurePass123!';
const MCP_PATH = '/api/v1/mcp';
const ACCEPT = 'application/json, text/event-stream';

/**
 * `@orthacms/tools-server`'s cross-consumer invariant: **one registry, two
 * surfaces**.
 *
 * The other suites drive one consumer each — `mcp/mcp.spec.ts` the endpoint,
 * `copilot/copilot-read-catalogue.spec.ts` the run — and neither can see the
 * thing they share. If `McpModule` and `CopilotModule` each ended up with their
 * own `ToolRegistry`, every capability plugin would register into whichever one
 * DI happened to hand it and the other would hold an empty catalogue, silently.
 * That failure is invisible to a suite that boots both and asks only one.
 *
 * So this file asks both in one app, and then boots the app with each consumer
 * removed in turn — because a registry provided by either of them would take
 * the other's tools down with it, which is exactly the wiring `ToolsModule`
 * (global, imported by both, provided by neither) exists to prevent.
 */
describe('Tool registry (one registry, two surfaces)', () => {
    /** Signs an admin in against a harness and returns a cookie-bearing agent. */
    async function signInAdmin(harness: TestApp, workspace: SeededWorkspace) {
        const user = await seedActiveUser(harness.app, {
            email: ADMIN_EMAIL,
            password: PASSWORD,
            role: 'admin'
        });
        await seedMembership(user.id, workspace.id);
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email: ADMIN_EMAIL, password: PASSWORD })
            .expect(201);
        return agent;
    }

    /** Mints a full-scope API token for the MCP surface. */
    async function mintToken(agent: request.Agent, workspaceId: string) {
        const res = await agent
            .post('/api/api-tokens')
            .send({
                name: 'tool-registry-e2e',
                workspaceIds: [workspaceId],
                scope: 'full'
            })
            .expect(201);
        return res.body.secret as string;
    }

    /** The tool names `tools/list` shows this token. */
    async function mcpToolNames(harness: TestApp, secret: string) {
        const res = await request(harness.server)
            .post(MCP_PATH)
            .set('Authorization', `Bearer ${secret}`)
            .set('Accept', ACCEPT)
            .send({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
            .expect(200);
        const result = res.body.result as { tools: { name: string }[] };
        return result.tools.map((tool) => tool.name);
    }

    /** The tool names one copilot run offered the model. */
    async function copilotToolNames(
        harness: TestApp,
        agent: request.Agent,
        workspaceId: string
    ) {
        scriptCopilot({ text: 'ok' });
        const response = await agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', workspaceId)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ message: 'hello' })
            .expect(200);
        parseSse(response.text);
        return (copilotCalls()[0]?.tools ?? []).map((tool) => tool.name);
    }

    describe('both consumers mounted', () => {
        let harness: TestApp;
        let workspace: SeededWorkspace;

        beforeAll(async () => {
            harness = await createTestApp();
        });
        afterAll(async () => {
            await closeTestApp(harness);
        });
        beforeEach(async () => {
            await resetDb();
            resetCopilot();
            workspace = await seedWorkspace({ name: 'Docs', slug: 'docs' });
            await seedContentGrants(workspace.id, ['test_article']);
        });

        // A tool registers exactly once, into whatever instance DI handed its
        // plugin. Both consumers seeing the *same* tool is therefore the proof
        // that there is one instance — and a shared tool is the only kind that
        // can be asked of both.
        it('shows one shared tool to both surfaces of one running app [tools:I-17]', async () => {
            const agent = await signInAdmin(harness, workspace);
            const secret = await mintToken(agent, workspace.id);

            expect(await mcpToolNames(harness, secret)).toEqual(
                expect.arrayContaining([
                    'media_assets_search',
                    'i18n_locales_list'
                ])
            );
            expect(
                await copilotToolNames(harness, agent, workspace.id)
            ).toEqual(
                expect.arrayContaining([
                    'media_assets_search',
                    'i18n_locales_list'
                ])
            );
        });

        // And each still keeps what is its own — otherwise "one registry" would
        // be indistinguishable from "one catalogue with no surface filtering".
        it('keeps each surface’s narrowed tools to itself', async () => {
            const agent = await signInAdmin(harness, workspace);
            const secret = await mintToken(agent, workspace.id);

            const overMcp = await mcpToolNames(harness, secret);
            const overCopilot = await copilotToolNames(
                harness,
                agent,
                workspace.id
            );

            expect(overMcp).toContain('content_create');
            expect(overMcp).not.toContain('content_propose_create');
            expect(overCopilot).toContain('content_propose_create');
            expect(overCopilot).not.toContain('content_create');
        });
    });

    describe('the MCP endpoint unmounted', () => {
        let harness: TestApp;
        let workspace: SeededWorkspace;

        beforeAll(async () => {
            harness = await createTestApp({ mcpEnabled: false });
        });
        afterAll(async () => {
            await closeTestApp(harness);
        });
        beforeEach(async () => {
            await resetDb();
            resetCopilot();
            workspace = await seedWorkspace({ name: 'Docs', slug: 'docs' });
            await seedContentGrants(workspace.id, ['test_article']);
        });

        it('leaves the copilot a full catalogue [mcp:I-20] [tools:I-19]', async () => {
            const agent = await signInAdmin(harness, workspace);

            await request(harness.server).post(MCP_PATH).send({}).expect(404);

            expect(
                await copilotToolNames(harness, agent, workspace.id)
            ).toEqual(
                expect.arrayContaining([
                    'admin_content_search',
                    'media_assets_search',
                    'i18n_locales_list'
                ])
            );
        });
    });

    describe('the copilot unmounted', () => {
        let harness: TestApp;
        let workspace: SeededWorkspace;

        beforeAll(async () => {
            harness = await createTestApp({ copilot: { enabled: false } });
        });
        afterAll(async () => {
            await closeTestApp(harness);
        });
        beforeEach(async () => {
            await resetDb();
            workspace = await seedWorkspace({ name: 'Docs', slug: 'docs' });
            await seedContentGrants(workspace.id, ['test_article']);
        });

        it('leaves the MCP endpoint a full catalogue [copilot:I-34] [mcp:I-20] [tools:I-19]', async () => {
            const agent = await signInAdmin(harness, workspace);
            const secret = await mintToken(agent, workspace.id);

            expect(await mcpToolNames(harness, secret)).toEqual(
                expect.arrayContaining([
                    'content_create',
                    'media_assets_search',
                    'i18n_locales_list'
                ])
            );
        });

        // What "unmounted" now means. The switch used to be read in one place —
        // `RunEngine.run` — so a disabled deployment still served the model
        // catalogue, the conversation and skill routes and both admin surfaces,
        // and refused only at the moment somebody pressed send. `MCP_ENABLED`
        // has always taken its route away; this one now does too.
        it('serves no copilot route at all', async () => {
            const agent = await signInAdmin(harness, workspace);

            await agent
                .get('/api/copilot/models')
                .set('X-Workspace-Id', workspace.id)
                .expect(404);
            await agent
                .get('/api/copilot/conversations')
                .set('X-Workspace-Id', workspace.id)
                .expect(404);
            await agent
                .get('/api/copilot/skills')
                .set('X-Workspace-Id', workspace.id)
                .expect(404);
        });
    });
});
