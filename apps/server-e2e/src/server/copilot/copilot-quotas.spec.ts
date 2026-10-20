import request from 'supertest';
import type { CopilotRunEvent } from '@orthacms/copilot-domain';
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
    copilotUsageRows,
    registerCopilotTools,
    scriptCopilot
} from '../../support/copilot';
import { FixtureToolProvider } from '../../support/copilot-fixture-tools';
import { framesOfType, parseSse, streamSse } from '../../support/sse';
import {
    TEST_ALLOWED_ORIGIN,
    type TestConfigOverrides
} from '../../support/test-config';

const PASSWORD = 'SecurePass123!';

/** A turn that answers and reports exactly `tokens` billable tokens. */
const answer = (tokens: number, text = 'Done.') => ({
    text,
    usage: { inputTokens: tokens - 1, outputTokens: 1 }
});

/**
 * The copilot's usage limits, end to end: daily token quotas per user and per
 * workspace, runs per minute, and runs in flight — all of them read from the
 * real ledger (`copilot_usage`) and the real rate-limit store
 * (`throttle_buckets`), which is what makes them hold across instances and
 * survive a restart.
 *
 * The fake provider's `usage` override is what spends a quota: every scripted
 * turn names the tokens it costs, so a test can spend exactly up to a limit.
 */
function suite(overrides: TestConfigOverrides) {
    const state: {
        harness: TestApp;
        workspace: SeededWorkspace;
        other: SeededWorkspace;
    } = {} as never;
    const fixtures = new FixtureToolProvider();

    beforeAll(async () => {
        state.harness = await createTestApp(overrides);
        registerCopilotTools(state.harness.app, fixtures);
    });

    afterAll(async () => {
        await closeTestApp(state.harness);
    });

    beforeEach(async () => {
        await resetDb();
        state.workspace = await seedWorkspace({ name: 'Docs', slug: 'docs' });
        state.other = await seedWorkspace({ name: 'Other', slug: 'other' });
        await seedContentGrants(state.workspace.id, ['test_article']);
        await seedContentGrants(state.other.id, ['test_article']);
    });

    async function signIn(email: string, ...workspaces: SeededWorkspace[]) {
        const user = await seedActiveUser(state.harness.app, {
            email,
            password: PASSWORD,
            role: 'contributor'
        });
        for (const ws of workspaces.length ? workspaces : [state.workspace]) {
            await seedMembership(user.id, ws.id);
        }
        const agent = request.agent(state.harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        return { user, agent };
    }

    function post(agent: request.Agent, ws: SeededWorkspace = state.workspace) {
        return agent
            .post('/api/copilot/runs')
            .set('X-Workspace-Id', ws.id)
            .set('Origin', TEST_ALLOWED_ORIGIN)
            .send({ message: 'Hello' });
    }

    async function run(
        agent: request.Agent,
        ws: SeededWorkspace = state.workspace
    ): Promise<CopilotRunEvent[]> {
        const response = await post(agent, ws).expect(200);
        return parseSse(response.text);
    }

    function conversations(agent: request.Agent) {
        return agent
            .get('/api/copilot/conversations')
            .set('X-Workspace-Id', state.workspace.id)
            .expect(200)
            .then((response) => response.body.items as { id: string }[]);
    }

    return { state, fixtures, signIn, post, run, conversations };
}

describe('Copilot daily quotas', () => {
    const { state, signIn, post, run, conversations } = suite({
        copilot: {
            quotas: { userDailyTokens: 1000, workspaceDailyTokens: 1500 }
        }
    });

    it('refuses a run once the user’s quota is spent, before anything is stored [copilot:I-44]', async () => {
        const { agent } = await signIn('quota-alice@example.com');
        scriptCopilot(answer(1000));
        await run(agent);
        const before = await conversations(agent);

        const refused = await post(agent).expect(429);

        expect(refused.body).toEqual({
            statusCode: 429,
            code: 'copilot.quota_exceeded',
            scope: 'user',
            message: expect.any(String),
            resetsAt: expect.stringMatching(/T00:00:00\.000Z$/)
        });
        expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
        // No stream, no thread, no stored question, and no model call.
        expect(refused.headers['content-type']).toContain('application/json');
        expect(await conversations(agent)).toHaveLength(before.length);
        expect(copilotCalls()).toHaveLength(1);
    });

    it('shares the workspace’s quota between its members', async () => {
        const { agent: alice } = await signIn('quota-alice@example.com');
        const { agent: bob } = await signIn('quota-bob@example.com');
        scriptCopilot(answer(800), answer(700));
        await run(alice);
        await run(bob);

        const refused = await post(bob).expect(429);

        expect(refused.body).toEqual(
            expect.objectContaining({
                code: 'copilot.quota_exceeded',
                scope: 'workspace'
            })
        );
    });

    it('counts a user’s quota per workspace', async () => {
        const { agent } = await signIn(
            'quota-alice@example.com',
            state.workspace,
            state.other
        );
        scriptCopilot(answer(1000), answer(10));
        await run(agent);
        await post(agent).expect(429);

        const elsewhere = await run(agent, state.other);

        expect(framesOfType(elsewhere, 'done')[0]).toEqual(
            expect.objectContaining({ stopReason: 'end' })
        );
    });

    // Between steps, like the run's own token ceiling: the call that spent
    // the last of it completes, the next never happens, and what the run
    // already said is kept.
    it('stops a run that spends what was left, keeping its answer [copilot:I-47]', async () => {
        const { agent } = await signIn('quota-alice@example.com');
        scriptCopilot(
            {
                text: 'Looking it up.',
                toolCalls: [{ name: 'fixture.readThing', input: { q: 'x' } }],
                usage: { inputTokens: 900, outputTokens: 200 }
            },
            answer(10)
        );

        const frames = await run(agent);

        expect(framesOfType(frames, 'done')[0]).toEqual(
            expect.objectContaining({ stopReason: 'quota' })
        );
        expect(copilotCalls()).toHaveLength(1);
        const [thread] = await conversations(agent);
        const transcript = await agent
            .get(`/api/copilot/conversations/${thread?.id}`)
            .set('X-Workspace-Id', state.workspace.id)
            .expect(200);
        const assistant = (
            transcript.body.messages as { role: string; stopReason: string }[]
        ).find((message) => message.role === 'assistant');
        expect(assistant?.stopReason).toBe('quota');
    });

    it('charges the run’s ledger row and closes it [copilot:I-45] [copilot:I-46]', async () => {
        const { user, agent } = await signIn('quota-alice@example.com');
        scriptCopilot({
            text: 'Hi.',
            usage: {
                inputTokens: 100,
                outputTokens: 20,
                cachedInputTokens: 5000,
                cacheWriteInputTokens: 300
            }
        });

        const frames = await run(agent);

        const runId = (
            framesOfType(frames, 'run-started')[0] as { runId: string }
        ).runId;
        const [row] = await copilotUsageRows(state.harness.app, runId);
        expect(row).toEqual(
            expect.objectContaining({
                userId: user.id,
                workspaceId: state.workspace.id,
                inputTokens: 100,
                outputTokens: 20,
                cacheReadTokens: 5000,
                cacheWriteTokens: 300,
                // Cache reads are not charged; writes are.
                billableTokens: 420,
                status: 'finished',
                stopReason: 'end',
                conversationId: expect.any(String)
            })
        );
    });

    it('reports the user’s spend and only a flag for the workspace [copilot:I-50]', async () => {
        const { agent } = await signIn('quota-alice@example.com');
        scriptCopilot(answer(300));
        await run(agent);

        const usage = await agent
            .get('/api/copilot/usage')
            .set('X-Workspace-Id', state.workspace.id)
            .expect(200);

        expect(usage.body).toEqual({
            day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            resetsAt: expect.stringMatching(/T00:00:00\.000Z$/),
            user: { used: 300, limit: 1000 },
            workspace: { exhausted: false }
        });
    });

    it('serves usage only for a workspace the caller belongs to', async () => {
        const { agent } = await signIn('quota-alice@example.com');

        await agent
            .get('/api/copilot/usage')
            .set('X-Workspace-Id', state.other.id)
            .expect(403);
    });
});

describe('Copilot run rate and concurrency limits', () => {
    const { state, signIn, post, run } = suite({
        copilot: { quotas: { runsPerMinute: 3, maxConcurrentRuns: 1 } }
    });

    // Every request here comes from the same address; a limit keyed by IP
    // would refuse Bob for Alice's runs.
    it('counts runs per minute per user, not per address [copilot:I-49]', async () => {
        const { agent: alice } = await signIn('rate-alice@example.com');
        const { agent: bob } = await signIn('rate-bob@example.com');
        scriptCopilot(answer(1), answer(1), answer(1), answer(1));
        await run(alice);
        await run(alice);
        await run(alice);

        const refused = await post(alice).expect(429);

        expect(refused.body).toEqual(
            expect.objectContaining({
                code: 'copilot.rate_limited',
                scope: 'user'
            })
        );
        expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
        await run(bob);
    });

    it('refuses a second run while the first is in flight, and frees the slot when it ends', async () => {
        const { agent } = await signIn('rate-alice@example.com');
        scriptCopilot(
            {
                toolCalls: [{ name: 'fixture.applyThing', input: {} }],
                usage: { inputTokens: 1, outputTokens: 1 }
            },
            answer(1),
            answer(1)
        );
        let refused: request.Response | undefined;

        // The first run parks on its permission prompt — in flight, holding
        // its slot — and the second is tried from inside that wait, then the
        // first is let go.
        const first = await streamSse(post(agent).expect(200), (event) => {
            if (event.type !== 'tool-permission-request') return;
            void post(agent).then(async (response) => {
                refused = response;
                await agent
                    .post(`/api/copilot/runs/${event.runId}/permission`)
                    .set('X-Workspace-Id', state.workspace.id)
                    .set('Origin', TEST_ALLOWED_ORIGIN)
                    .send({ callId: event.id, decision: 'once' })
                    .expect(204);
            });
        });

        expect(refused?.status).toBe(429);
        expect(refused?.body).toEqual(
            expect.objectContaining({
                code: 'copilot.too_many_runs',
                scope: 'user'
            })
        );
        // Nobody can say when the run in flight will end.
        expect(refused?.headers['retry-after']).toBeUndefined();
        expect(framesOfType(first, 'done')[0]).toEqual(
            expect.objectContaining({ stopReason: 'end' })
        );
        // Its row is closed, so the slot is free again.
        await run(agent);
    });
});

describe('Copilot with no usage limits', () => {
    const { state, signIn, run } = suite({});

    // Spend is recorded either way, so a quota switched on later sees today.
    it('still records the run’s spend [copilot:I-45]', async () => {
        const { agent } = await signIn('free-alice@example.com');
        scriptCopilot(answer(250));

        const frames = await run(agent);

        const runId = (
            framesOfType(frames, 'run-started')[0] as { runId: string }
        ).runId;
        const [row] = await copilotUsageRows(state.harness.app, runId);
        expect(row).toEqual(
            expect.objectContaining({ billableTokens: 250, status: 'finished' })
        );
    });

    it('reports no quota rather than inventing one', async () => {
        const { agent } = await signIn('free-alice@example.com');

        const usage = await agent
            .get('/api/copilot/usage')
            .set('X-Workspace-Id', state.workspace.id)
            .expect(200);

        expect(usage.body.user).toEqual({ used: 0, limit: null });
        expect(usage.body.workspace).toEqual({ exhausted: false });
    });
});
