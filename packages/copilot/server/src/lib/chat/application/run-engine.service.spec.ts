import {
    abortedEvent,
    type CopilotRunEvent,
    type RunLimits,
    type ModelProvider,
    type ModelRequest,
    type ModelStreamEvent,
    type Skill
} from '@orthacms/copilot-domain';
import type { ToolDefinition, ToolRegistry } from '@orthacms/tools-server';
import { buildModelRegistry } from '../../infrastructure/model-registry';
import type { CopilotPluginConfig } from '../../types/copilot-config';
import type {
    ConversationRepository,
    MessageView
} from '../infrastructure/persistence/conversation.repository';
import type { ProposalRepository } from '../infrastructure/persistence/proposal.repository';
import type { SkillCatalogService } from '../../skills/application/skill-catalog.service';
import type { CapabilityProfileService } from './capability-profile.service';
import type { DecideProposalService } from './decide-proposal.service';
import { RunEngine, type StartRunInput } from './run-engine.service';
import type { ToolPermissionBroker } from './tool-permission.broker';

/**
 * The engine is an async generator, which is what makes these tests possible
 * without a socket: a test drives it with `next()` and sees exactly what the
 * SSE controller would write, in the order it would write it.
 *
 * Two things about the loop are only observable from here. **Streaming** is a
 * timing property — a buffered implementation produces the same frames in the
 * same order, just all at once at the end — so it needs a provider that stops
 * mid-answer and a consumer that reads before it is allowed to continue. And
 * the **persist-on-abort** branch needs a run that ends badly, which no e2e in
 * the suite drives: nothing there cancels a run or makes a provider throw.
 */

/** A read-only tool, the only thing the profile offers in these runs. */
const READ_TOOL = {
    name: 'fixture_read',
    title: 'Read a fixture',
    description: 'Reads something.',
    inputSchema: { type: 'object', properties: {} },
    requires: [],
    readOnly: true,
    effect: 'read',
    handler: async () => ({ ok: true })
} as unknown as ToolDefinition;

/** A promise the test resolves by hand, to hold a provider mid-stream. */
function gate() {
    let open!: () => void;
    const closed = new Promise<void>((resolve) => {
        open = resolve;
    });
    return { closed, open };
}

/** The model requests a provider actually received. */
type Seen = ModelRequest[];

/** A provider whose stream is whatever the test scripts. */
function fakeProvider(
    script: (
        request: ModelRequest,
        signal?: AbortSignal
    ) => AsyncIterable<ModelStreamEvent>
): { provider: ModelProvider; seen: Seen } {
    const seen: Seen = [];
    return {
        seen,
        provider: {
            models: () => ['fixture-model'],
            capabilities: async () => ({
                streaming: true,
                tools: true,
                maxOutputTokens: 1024
            }),
            stream(request: ModelRequest, signal?: AbortSignal) {
                seen.push(request);
                return script(request, signal);
            }
        } as unknown as ModelProvider
    };
}

/** The transcript, in memory, with every write recorded in order. */
function fakeConversations() {
    const rows: MessageView[] = [];
    /** What each `appendMessage` was handed, serialised at the moment of the call. */
    const written: string[] = [];
    const appendMessage = jest.fn(
        async (
            input: Parameters<ConversationRepository['appendMessage']>[0]
        ) => {
            written.push(JSON.stringify(input));
            const row: MessageView = {
                id: `message-${rows.length + 1}`,
                runId: input.runId,
                role: input.role,
                content: input.content,
                attachments: input.attachments ?? null,
                skills: input.skills ?? null,
                model: input.model ?? null,
                provider: input.provider ?? null,
                stopReason: input.stopReason ?? null,
                position: rows.length + 1,
                createdAt: new Date()
            };
            rows.push(row);
            return { id: row.id, position: row.position };
        }
    );
    return {
        rows,
        written,
        appendMessage,
        create: jest.fn(async () => ({ id: 'conversation-1' })),
        findOrFail: jest.fn(),
        update: jest.fn(),
        messages: jest.fn(async () => rows),
        allowedTools: jest.fn(async () => [] as string[]),
        allowTool: jest.fn(),
        recordToolCall: jest.fn()
    };
}

/** The assistant rows the engine wrote, in transcript order. */
const assistantRows = (rows: MessageView[]) =>
    rows.filter((row) => row.role === 'assistant');

interface Harness {
    engine: RunEngine;
    conversations: ReturnType<typeof fakeConversations>;
    seen: Seen;
    /** The shared tool registry, so a test can see whether a call ran. */
    tools: { call: jest.Mock };
}

/**
 * A clock the test moves by hand.
 *
 * The engine measures a run against `Date.now()`, so a ceiling test that waited
 * in real time would either be slow or be a race. Advancing it from inside the
 * provider's script puts the passage of time exactly where it happens in
 * production: while the model is answering.
 */
function fakeClock(start = 1_700_000_000_000) {
    let now = start;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    return {
        advance(ms: number) {
            now += ms;
        }
    };
}

function harness(
    script: (
        request: ModelRequest,
        signal?: AbortSignal
    ) => AsyncIterable<ModelStreamEvent>,
    options: {
        tools?: ToolDefinition[];
        skillsInForce?: Skill[];
        skillsFail?: Error;
        limits?: Partial<RunLimits>;
    } = {}
): Harness {
    const { provider, seen } = fakeProvider(script);
    const conversations = fakeConversations();
    const profile = {
        tools: options.tools ?? [READ_TOOL],
        withheld: []
    };
    const profiles = {
        resolve: async () => ({
            profile,
            context: {
                userId: 'user-1',
                workspaceId: 'workspace-1',
                surface: 'copilot'
            }
        })
    };
    const skills = {
        resolveRunSkills: async () => {
            if (options.skillsFail) {
                throw options.skillsFail;
            }
            return {
                available: options.skillsInForce ?? [],
                inForce: options.skillsInForce ?? []
            };
        }
    };
    const tools = { call: jest.fn(async () => ({ ok: true })) };
    const config: CopilotPluginConfig = {
        enabled: true,
        maxOutputTokens: 1024
    };

    const engine = new RunEngine(
        buildModelRegistry([{ name: 'fixture', provider }]),
        () => 'fixture',
        config,
        profiles as unknown as CapabilityProfileService,
        tools as unknown as ToolRegistry,
        conversations as unknown as ConversationRepository,
        {} as ProposalRepository,
        {} as DecideProposalService,
        {} as ToolPermissionBroker,
        skills as unknown as SkillCatalogService,
        null,
        {
            maxSteps: 5,
            wallClockMs: 60_000,
            maxTotalTokens: 100_000,
            ...options.limits
        }
    );

    return { engine, conversations, seen, tools };
}

/** What the controller hands the engine. */
function startInput(signal: AbortSignal): StartRunInput {
    return {
        userId: 'user-1',
        userEmail: 'editor@example.com',
        roleId: 'role-1',
        workspaceId: 'workspace-1',
        message: 'Say something',
        context: {},
        uiLocale: 'en',
        typeSummaries: [],
        signal
    };
}

/** Drains a run to the end, collecting every frame. */
async function drain(
    events: AsyncGenerator<CopilotRunEvent>
): Promise<CopilotRunEvent[]> {
    const frames: CopilotRunEvent[] = [];
    for await (const event of events) {
        frames.push(event);
    }
    return frames;
}

const STILL_WAITING = Symbol('still waiting');

/** The next frame, or `STILL_WAITING` if it does not arrive promptly. */
async function nextWithin<T>(
    pending: Promise<T>,
    ms = 500
): Promise<T | typeof STILL_WAITING> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<typeof STILL_WAITING>((resolve) => {
        timer = setTimeout(() => resolve(STILL_WAITING), ms);
    });
    return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}

describe('RunEngine streaming', () => {
    /**
     * The invariant is about *when* a delta reaches the client, and the only
     * fixture that can tell the two implementations apart is a provider that
     * has not finished yet: this one emits one delta and then stops dead until
     * the test lets it go. An engine that collected deltas into an array and
     * flushed them after the stream ended would leave the consumer waiting on
     * the same promise the provider is waiting on — which is the deadlock this
     * test times out on.
     */
    it('forwards a delta before the provider has finished the answer [copilot:I-23]', async () => {
        const held = gate();
        const { engine } = harness(async function* () {
            yield { type: 'text-delta', text: 'Once upon ' };
            await held.closed;
            yield { type: 'text-delta', text: 'a time.' };
            yield {
                type: 'done',
                stopReason: 'end',
                usage: { inputTokens: 10, outputTokens: 4 }
            };
        });
        const controller = new AbortController();
        const events = engine.run(startInput(controller.signal));

        expect((await events.next()).value).toMatchObject({
            type: 'run-started'
        });

        // The provider is still parked on `held.closed` — nothing has told it
        // the answer is over, and this frame has to arrive anyway.
        const first = await nextWithin(events.next());
        expect(first).not.toBe(STILL_WAITING);
        expect((first as IteratorResult<CopilotRunEvent>).value).toEqual({
            type: 'text-delta',
            text: 'Once upon '
        });

        held.open();
        const rest = await drain(events);
        expect(rest).toEqual([
            { type: 'text-delta', text: 'a time.' },
            expect.objectContaining({ type: 'done', stopReason: 'end' })
        ]);
    });
});

describe('RunEngine when a run ends badly', () => {
    /**
     * A cancelled run is the ordinary case, not the exotic one: the server
     * treats a closed tab as a cancellation, so anything half-written is
     * everything the user will ever see of that turn. Storing it is what makes
     * "reopen the thread and read what it managed to say" work at all — and
     * `loadHistory` depends on the row being there, because that is where the
     * `aborted` stop reason it replays as an interruption note comes from.
     */
    it('stores the half-finished answer when the client hangs up [copilot:I-25]', async () => {
        const controller = new AbortController();
        const { engine, conversations } = harness(async function* () {
            yield { type: 'text-delta', text: 'I was saying' };
            // The tab closed: the controller aborts, and this adapter surfaces
            // the cancellation by throwing out of the stream.
            controller.abort();
            const error = new Error('The operation was aborted');
            error.name = 'AbortError';
            throw error;
        });

        const frames = await drain(engine.run(startInput(controller.signal)));

        expect(frames).toContainEqual({
            type: 'done',
            stopReason: 'aborted',
            usage: { inputTokens: 0, outputTokens: 0 },
            messageId: 'message-2'
        });
        // A cancellation is not a failure: nothing is reported to the user.
        expect(frames.some((frame) => frame.type === 'error')).toBe(false);

        expect(assistantRows(conversations.rows)).toEqual([
            expect.objectContaining({
                stopReason: 'aborted',
                content: [{ type: 'text', text: 'I was saying' }]
            })
        ]);
    });

    /**
     * The same, through the *conformant* adapter path: the port's contract is
     * that an abort ends the stream with a `done` rather than throwing, so the
     * loop returns `aborted` without an exception ever being raised. Both
     * routes have to reach the same write, or which adapter is configured
     * decides whether a cancelled turn survives.
     */
    it('stores it when the adapter ends the stream instead of throwing [copilot:I-25]', async () => {
        const controller = new AbortController();
        const { engine, conversations } = harness(async function* () {
            yield { type: 'text-delta', text: 'I was saying' };
            controller.abort();
            yield abortedEvent();
        });

        const frames = await drain(engine.run(startInput(controller.signal)));

        expect(frames).toContainEqual(
            expect.objectContaining({ type: 'done', stopReason: 'aborted' })
        );
        expect(assistantRows(conversations.rows)).toEqual([
            expect.objectContaining({
                stopReason: 'aborted',
                content: [{ type: 'text', text: 'I was saying' }]
            })
        ]);
    });

    /**
     * A failure keeps the partial turn too, and says so in the row: the
     * transcript is the record of what happened, and a run that fell over
     * halfway is something that happened.
     */
    it('stores the half-finished answer when the provider fails [copilot:I-25]', async () => {
        const { engine, conversations } = harness(async function* () {
            yield { type: 'text-delta', text: 'I was saying' };
            throw new Error('the backend went away');
        });
        const controller = new AbortController();

        const frames = await drain(engine.run(startInput(controller.signal)));

        expect(frames).toContainEqual(
            expect.objectContaining({ type: 'error' })
        );
        expect(frames.at(-1)).toEqual(
            expect.objectContaining({ type: 'done', stopReason: 'error' })
        );
        expect(assistantRows(conversations.rows)).toEqual([
            expect.objectContaining({
                stopReason: 'error',
                content: [{ type: 'text', text: 'I was saying' }]
            })
        ]);
    });

    /**
     * Append-only, and the second half of the invariant: the row is written
     * once and never touched again. Two appends — the question, then whatever
     * the turn produced — and nothing that edits either afterwards.
     */
    it('appends the turn once and does not edit it afterwards [copilot:I-25]', async () => {
        const controller = new AbortController();
        const { engine, conversations } = harness(async function* () {
            yield { type: 'text-delta', text: 'I was saying' };
            controller.abort();
            yield abortedEvent();
        });

        await drain(engine.run(startInput(controller.signal)));

        expect(conversations.appendMessage).toHaveBeenCalledTimes(2);
        expect(conversations.update).not.toHaveBeenCalled();
        // The row's content is byte-for-byte what was handed to the write, so
        // an engine that kept the array and pushed into it after persisting —
        // the ordinary way an "append-only" table stops being one — fails here.
        expect(conversations.written).toEqual(
            conversations.rows.map((row) =>
                JSON.stringify({
                    conversationId: 'conversation-1',
                    runId: row.runId,
                    role: row.role,
                    content: row.content,
                    ...(row.role === 'user'
                        ? { attachments: [], skills: [] }
                        : {
                              model: row.model,
                              provider: row.provider,
                              stopReason: row.stopReason,
                              inputTokens: 0,
                              outputTokens: 0
                          })
                })
            )
        );
    });
});

describe('RunEngine with a skill in force', () => {
    const houseStyle: Skill = {
        name: 'house-style',
        title: 'House style',
        description: 'How we write.',
        instructions:
            'Write in sentence case, and publish anything you finish.',
        mode: 'always',
        source: 'cms'
    };

    /**
     * A skill changes *how* the copilot works and must never change *what it
     * may do* — the distinction ADR-0010's admin-only write permission rests
     * on. There is no field for it to try (`skill-fields.spec.ts` pins that),
     * and this is the behavioural half: an always-on skill is genuinely in
     * force — its body is in the system prompt the provider received — and the
     * tool set the model is offered is still exactly the capability profile's.
     */
    it('changes the prompt and not the tool set [copilot:I-28]', async () => {
        const { engine, seen } = harness(
            async function* () {
                yield {
                    type: 'done',
                    stopReason: 'end',
                    usage: { inputTokens: 1, outputTokens: 1 }
                };
            },
            { skillsInForce: [houseStyle] }
        );
        const controller = new AbortController();

        await drain(engine.run(startInput(controller.signal)));

        expect(seen).toHaveLength(1);
        // The skill really is in force — otherwise the tool assertion below
        // would hold for the trivial reason that nothing was applied.
        expect(seen[0].system).toContain(
            'Write in sentence case, and publish anything you finish.'
        );
        expect(seen[0].tools?.map((tool) => tool.name)).toEqual([
            'fixture_read'
        ]);
    });
});

describe('RunEngine ceilings', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    /**
     * The wall clock is checked **per tool call**, not only at the top of a
     * step — one step may ask for any number of tools and each can park for a
     * human, so a turn requesting thirty writes used to run all thirty and
     * report `timeout` at the top of a step it was never going to reach.
     *
     * And the refusal is *fed back*: every `tool_use` block needs a matching
     * `tool_result` or the assistant turn just pushed is malformed for both
     * wire formats — a run that ends on a ceiling still has to leave a
     * transcript the next turn can replay.
     */
    it('refuses a call on the wall clock and still answers it with a tool_result [copilot:I-21]', async () => {
        const clock = fakeClock();
        const { engine, conversations, tools } = harness(
            async function* () {
                yield {
                    type: 'tool-call',
                    id: 'call-1',
                    name: 'fixture_read',
                    input: {}
                };
                // The model thought about it for four minutes.
                clock.advance(240_000);
                yield {
                    type: 'done',
                    stopReason: 'tool_use',
                    usage: { inputTokens: 5, outputTokens: 5 }
                };
            },
            { limits: { wallClockMs: 60_000 } }
        );
        const controller = new AbortController();

        const frames = await drain(engine.run(startInput(controller.signal)));

        expect(frames.at(-1)).toEqual(
            expect.objectContaining({ type: 'done', stopReason: 'timeout' })
        );
        expect(tools.call).not.toHaveBeenCalled();
        expect(frames).toContainEqual(
            expect.objectContaining({
                type: 'tool-result',
                id: 'call-1',
                ok: false,
                error: expect.stringContaining('time limit')
            })
        );
        // A refusal is audited like any other attempt — "this call never ran,
        // and why" is exactly what a reviewer reading `copilot_tool_calls` is
        // looking for. (The timed-out category of `copilot:I-17`; refused-by-
        // the-user is still pinned by nothing.)
        expect(conversations.recordToolCall).toHaveBeenCalledWith(
            expect.objectContaining({
                callId: 'call-1',
                name: 'fixture_read',
                ok: false,
                error: expect.stringContaining('time limit')
            })
        );
        // The turn is well-formed: the refused call has its result.
        expect(assistantRows(conversations.rows)[0].content).toEqual([
            expect.objectContaining({ type: 'tool_use', id: 'call-1' }),
            expect.objectContaining({
                type: 'tool_result',
                toolUseId: 'call-1'
            })
        ]);
    });

    /**
     * The token ceiling is the one checked only *between* steps — a run can
     * overshoot it by a whole model call, and does. What it must not do is take
     * another one.
     */
    it('stops between steps once the token ceiling is spent [copilot:I-21]', async () => {
        const { engine, seen } = harness(
            async function* () {
                yield {
                    type: 'tool-call',
                    id: 'call-1',
                    name: 'fixture_read',
                    input: {}
                };
                yield {
                    type: 'done',
                    stopReason: 'tool_use',
                    usage: { inputTokens: 4_000, outputTokens: 4_000 }
                };
            },
            { limits: { maxTotalTokens: 100 } }
        );
        const controller = new AbortController();

        const frames = await drain(engine.run(startInput(controller.signal)));

        expect(frames.at(-1)).toEqual(
            expect.objectContaining({
                type: 'done',
                stopReason: 'max-tokens',
                usage: { inputTokens: 4_000, outputTokens: 4_000 }
            })
        );
        // The ceiling ended it, not the script: the model was called once, and
        // the step the tool result was gathered for never happened.
        expect(seen).toHaveLength(1);
    });
});

describe('RunEngine ordering', () => {
    /**
     * The question is persisted **before** the model is called, so a connection
     * that drops during the answer never loses what somebody typed.
     */
    it('stores the question before the model is called [copilot:I-24]', async () => {
        // Read inside the provider's own script — the one moment that can tell
        // "stored before the call" from "stored around it".
        const atCall: { roles?: string[] } = {};
        const built = harness(async function* () {
            atCall.roles = built.conversations.rows.map((row) => row.role);
            yield {
                type: 'done',
                stopReason: 'end',
                usage: { inputTokens: 1, outputTokens: 1 }
            };
        });
        const controller = new AbortController();

        await drain(built.engine.run(startInput(controller.signal)));

        expect(atCall.roles).toEqual(['user']);
    });

    /**
     * And skills are resolved before the conversation is touched at all: a turn
     * must never be persisted claiming skills the model was not actually given,
     * and an unresolvable name is a bad request rather than a half-written
     * thread. Same ordering the attachment resolver gets, for the same reason.
     */
    it('resolves skills before the conversation is touched [copilot:I-24]', async () => {
        const { engine, conversations } = harness(
            async function* () {
                yield {
                    type: 'done',
                    stopReason: 'end',
                    usage: { inputTokens: 1, outputTokens: 1 }
                };
            },
            { skillsFail: new Error('One of the skills is unavailable.') }
        );
        const controller = new AbortController();

        await expect(
            drain(engine.run(startInput(controller.signal)))
        ).rejects.toThrow('One of the skills is unavailable.');

        expect(conversations.create).not.toHaveBeenCalled();
        expect(conversations.appendMessage).not.toHaveBeenCalled();
    });
});
