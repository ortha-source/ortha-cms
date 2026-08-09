import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
    DEFAULT_RUN_LIMITS,
    MODEL_REGISTRY,
    MODEL_RESOLVER,
    fenceUntrusted,
    isAbortError,
    isProposalDraft,
    resolveModel,
    validateToolInput,
    type CopilotRunEvent,
    type ModelContentBlock,
    type ModelMessage,
    type ModelRegistry,
    type ModelResolver,
    type ModelStreamEvent,
    type ModelTool,
    type ModelUsage,
    type ProposalDraft,
    type RunLimits,
    type RunStopReason,
    type ToolResultBlock,
    type ToolUseBlock
} from '@ortha-cms/copilot-domain';
import { ToolRegistry, type ToolDefinition } from '@ortha-cms/tools-server';
import { COPILOT_RUN_LIMITS, InjectCopilotConfig } from '../../copilot.tokens';
import type { CopilotPluginConfig } from '../../types/copilot-config';
import { ConversationRepository } from '../infrastructure/persistence/conversation.repository';
import { ProposalRepository } from '../infrastructure/persistence/proposal.repository';
import {
    CapabilityProfileService,
    type RunAuthority
} from './capability-profile.service';
import { DecideProposalService } from './decide-proposal.service';
import { summarizeToolOutput } from './summarize-tool-output';
import {
    buildSystemPrompt,
    SYSTEM_PROMPT_VERSION,
    type SurfaceContext
} from './system-prompt';

/** What the controller hands the engine to start one turn. */
export interface StartRunInput {
    /** The user the run acts as. */
    userId: string;
    /**
     * That user's email. Carried so an auto-applied proposal can freeze the
     * same actor snapshot onto its audit event that a hand-made edit would —
     * without a lookup in the one path where getting the actor wrong is least
     * acceptable.
     */
    userEmail: string;
    /** The user's role, for resolving the capability profile. */
    roleId: string;
    /** The workspace the run is scoped to; membership already proven. */
    workspaceId: string;
    /** Continue this thread, or start a new one when absent. */
    conversationId?: string;
    /** What the user typed. */
    message: string;
    /** Where the user is. */
    context: SurfaceContext;
    /** The admin UI's locale — the language to answer in. */
    uiLocale: string;
    /** Content-type summaries for the workspace. */
    typeSummaries: readonly string[];
    /**
     * The backend this turn should run on. Either half may be omitted: no
     * provider means the host's resolver picks, and no model means that
     * provider's default. A user switching model mid-conversation simply sends
     * a different pair on the next turn — nothing is pinned to the thread.
     */
    choice?: { provider?: string; model?: string };
    /** Aborted when the client disconnects. */
    signal: AbortSignal;
}

/**
 * Thrown when a run names a provider or model that isn't registered. The
 * controller turns it into an error frame rather than a 500 — it is a bad
 * request, and by the time we know, the stream is usually already open.
 */
export class UnknownModelChoiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UnknownModelChoiceError';
    }
}

/** Thrown when a run cannot start at all — the controller maps it to a 4xx. */
export class CopilotDisabledError extends Error {
    constructor() {
        super('The copilot is disabled.');
        this.name = 'CopilotDisabledError';
    }
}

/**
 * The run engine: a **bounded** loop that calls the model, executes the tools
 * it asks for, feeds the results back, and stops on a final answer or a ceiling
 * ([`docs/design/copilot.md`](../../../../../../docs/design/copilot.md) §5).
 *
 * It is an async generator rather than a service that writes to a response.
 * That keeps the transport out of the engine — the SSE controller serializes
 * whatever this yields — and it is what makes the loop testable without a
 * socket: a test drains the generator and asserts on the event sequence.
 */
@Injectable()
export class RunEngine {
    private readonly logger = new Logger(RunEngine.name);

    /** The ceilings this engine enforces. */
    private readonly limits: RunLimits;

    constructor(
        @Inject(MODEL_REGISTRY) private readonly registry: ModelRegistry,
        @Inject(MODEL_RESOLVER) private readonly resolver: ModelResolver,
        @InjectCopilotConfig() private readonly config: CopilotPluginConfig,
        private readonly profiles: CapabilityProfileService,
        private readonly tools: ToolRegistry,
        private readonly conversations: ConversationRepository,
        private readonly proposals: ProposalRepository,
        private readonly decisions: DecideProposalService,
        @Optional()
        @Inject(COPILOT_RUN_LIMITS)
        limits: RunLimits | null = null
    ) {
        // Precedence: an explicitly bound token, then the host's config, then
        // the defaults. Config is the ordinary path (it is env-driven); the
        // token stays for tests that need to pin a limit without a whole config.
        this.limits = limits ?? { ...DEFAULT_RUN_LIMITS, ...config.limits };
    }

    /** Runs one turn, yielding events as they happen. */
    async *run(input: StartRunInput): AsyncGenerator<CopilotRunEvent> {
        if (!this.config.enabled) {
            // The operator's kill switch (ADR-0005 §10). Checked here rather
            // than in a guard so the reason reaches the user as a normal
            // answer instead of an opaque 403.
            throw new CopilotDisabledError();
        }

        const runId = randomUUID();
        const startedAt = Date.now();

        const conversation = input.conversationId
            ? await this.conversations.findOrFail(
                  input.conversationId,
                  input.userId,
                  input.workspaceId
              )
            : await this.conversations.create(
                  input.userId,
                  input.workspaceId,
                  input.context.surface ?? 'chat',
                  input.message
              );

        // The user's message is persisted BEFORE the model is called, so a
        // dropped connection never loses what someone typed (design §5, step 3).
        const userMessage = await this.conversations.appendMessage({
            conversationId: conversation.id,
            runId,
            role: 'user',
            content: [{ type: 'text', text: input.message }]
        });

        yield {
            type: 'run-started',
            conversationId: conversation.id,
            runId,
            messageId: userMessage.id
        };

        const authority = await this.profiles.resolve(
            {
                id: input.userId,
                email: input.userEmail,
                roleId: input.roleId
            },
            input.workspaceId,
            input.signal
        );
        const profile = authority.profile;

        // An explicitly requested provider wins over the host's resolver: the
        // resolver expresses a default routing policy, not a veto over what the
        // user picked from the catalogue they were shown.
        const providerName =
            input.choice?.provider ??
            this.resolver(
                { workspaceId: input.workspaceId, userId: input.userId },
                this.registry
            );
        if (!this.registry.has(providerName)) {
            throw new UnknownModelChoiceError(
                `Unknown model provider "${providerName}".`
            );
        }
        const provider = this.registry.get(providerName);

        // Resolved once, here, rather than left to the adapter: the run record
        // has to name the model that actually answered, and an adapter
        // resolving it internally would leave us writing `null` into
        // `copilot_messages.model` — exactly the column cost accounting and
        // "which model said this?" both read.
        const model = resolveModel(input.choice?.model, provider.models());

        const system = buildSystemPrompt({
            uiLocale: input.uiLocale,
            context: input.context,
            typeSummaries: input.typeSummaries,
            hasTools: profile.tools.length > 0,
            hasWriteTools: profile.tools.some((tool) => tool.effect !== 'read')
        });

        // The thread so far, plus this turn. Read from the transcript rather
        // than held in memory, so a continued conversation replays exactly what
        // was persisted.
        const history = await this.loadHistory(conversation.id);

        const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
        const assistantBlocks: ModelContentBlock[] = [];
        let stopReason: RunStopReason = 'end';

        try {
            stopReason = yield* this.loop({
                input,
                runId,
                conversationId: conversation.id,
                authority,
                provider: { name: providerName, provider },
                model,
                system,
                history,
                usage,
                assistantBlocks,
                startedAt
            });
        } catch (error) {
            if (isAbortError(error, input.signal)) {
                stopReason = 'aborted';
            } else {
                stopReason = 'error';
                this.logger.error(
                    `Copilot run ${runId} failed`,
                    error instanceof Error ? error.stack : String(error)
                );
                yield { type: 'error', message: userFacingMessage(error) };
            }
        }

        // The assistant turn is persisted even when the run was cancelled or
        // failed: the transcript is append-only and a partial answer is part of
        // what happened. Skipped only when nothing at all was produced.
        let assistantMessageId: string | undefined;
        if (assistantBlocks.length > 0) {
            const written = await this.conversations.appendMessage({
                conversationId: conversation.id,
                runId,
                role: 'assistant',
                content: assistantBlocks,
                model,
                provider: providerName,
                stopReason,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens
            });
            assistantMessageId = written.id;
        }

        yield {
            type: 'done',
            stopReason,
            usage,
            ...(assistantMessageId ? { messageId: assistantMessageId } : {})
        };
    }

    /**
     * The loop itself: model call → tool calls → repeat. Returns the reason the
     * run ended.
     */
    private async *loop(ctx: {
        input: StartRunInput;
        runId: string;
        conversationId: string;
        authority: RunAuthority;
        provider: { name: string; provider: ReturnType<ModelRegistry['get']> };
        model: string;
        system: string;
        history: ModelMessage[];
        usage: ModelUsage;
        assistantBlocks: ModelContentBlock[];
        startedAt: number;
    }): AsyncGenerator<CopilotRunEvent, RunStopReason> {
        const messages = [...ctx.history];
        const tools = toModelTools(ctx.authority.profile.tools);
        // Signatures of calls already made this run, so a model that asks for
        // the same thing twice is told rather than silently obliged.
        const alreadyCalled = new Set<string>();

        for (let step = 0; step < this.limits.maxSteps; step += 1) {
            if (ctx.input.signal.aborted) {
                return 'aborted';
            }
            if (Date.now() - ctx.startedAt > this.limits.wallClockMs) {
                return 'timeout';
            }
            if (totalTokens(ctx.usage) > this.limits.maxTotalTokens) {
                return 'max-tokens';
            }

            // `yield*` forwards each delta to the client as it arrives and
            // still gives us the turn's summary as the generator's return
            // value — the same shape `loop` itself uses to return its stop
            // reason.
            const turn = yield* this.streamTurn(ctx, messages, tools);

            ctx.usage.inputTokens += turn.usage.inputTokens;
            ctx.usage.outputTokens += turn.usage.outputTokens;
            if (turn.text) {
                ctx.assistantBlocks.push({ type: 'text', text: turn.text });
            }
            ctx.assistantBlocks.push(...turn.toolUses);

            if (turn.stopReason === 'aborted') return 'aborted';
            if (turn.stopReason === 'refusal') return 'refusal';
            if (turn.stopReason === 'max_tokens') return 'max-output-tokens';
            if (turn.toolUses.length === 0) return 'end';

            // The model asked for tools. Everything it said this turn — text
            // and tool_use blocks together — goes back as one assistant turn,
            // then the results ride on a user turn, which is what both wire
            // formats expect.
            messages.push({
                role: 'assistant',
                content: [
                    ...(turn.text
                        ? [{ type: 'text' as const, text: turn.text }]
                        : []),
                    ...turn.toolUses
                ]
            });

            const results: ToolResultBlock[] = [];
            for (const call of turn.toolUses) {
                yield {
                    type: 'tool-call',
                    id: call.id,
                    name: call.name,
                    input: call.input
                };
                const outcome = await this.executeTool(
                    ctx,
                    call,
                    alreadyCalled
                );
                results.push(outcome.block);
                // More than one event when the call produced a proposal: the
                // tool result is what the model was told, the proposal is what
                // the human is being asked to decide.
                for (const event of outcome.events) {
                    yield event;
                }
            }

            ctx.assistantBlocks.push(...results);
            messages.push({ role: 'user', content: results });
        }

        return 'max-steps';
    }

    /** One model call, reduced to text, tool uses, usage and a stop reason. */
    private async *streamTurn(
        ctx: {
            input: StartRunInput;
            system: string;
            model: string;
            provider: {
                name: string;
                provider: ReturnType<ModelRegistry['get']>;
            };
        },
        messages: ModelMessage[],
        tools: ModelTool[]
    ): AsyncGenerator<
        CopilotRunEvent,
        {
            text: string;
            toolUses: ToolUseBlock[];
            usage: ModelUsage;
            stopReason: string;
        }
    > {
        const toolUses: ToolUseBlock[] = [];
        let text = '';
        let usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };
        let stopReason = 'end';

        const stream = ctx.provider.provider.stream(
            {
                model: ctx.model,
                system: ctx.system,
                messages,
                ...(tools.length > 0 ? { tools } : {}),
                maxOutputTokens: this.config.maxOutputTokens
            },
            ctx.input.signal
        );

        for await (const event of stream as AsyncIterable<ModelStreamEvent>) {
            if (event.type === 'text-delta') {
                text += event.text;
                // Yielded, not collected. Buffering these into an array and
                // flushing after the provider's stream ends turns the whole
                // feature off: the answer arrives in one burst when the model
                // finishes, which looks exactly like a slow non-streaming API.
                yield { type: 'text-delta', text: event.text };
            } else if (event.type === 'tool-call') {
                toolUses.push({
                    type: 'tool_use',
                    id: event.id,
                    name: event.name,
                    input: event.input
                });
            } else {
                usage = event.usage;
                stopReason = event.stopReason;
            }
        }

        return { text, toolUses, usage, stopReason };
    }

    /**
     * Authorizes, validates and runs one tool call, and writes its audit row.
     *
     * **Never throws.** Every failure — unknown tool, revoked permission,
     * malformed arguments, a tool that blew up — comes back as a tool *error*
     * the model can recover from, and the run continues (design §5, step 6).
     * Turning a model mistake into a 500 would lose the whole turn.
     */
    private async executeTool(
        ctx: {
            input: StartRunInput;
            runId: string;
            conversationId: string;
            authority: RunAuthority;
        },
        call: ToolUseBlock,
        alreadyCalled: Set<string>
    ): Promise<{ block: ToolResultBlock; events: CopilotRunEvent[] }> {
        const startedAt = Date.now();
        const fail = async (message: string) => {
            const durationMs = Date.now() - startedAt;
            await this.audit(ctx, call, {
                ok: false,
                error: message,
                durationMs,
                outputSummary: null
            });
            return {
                block: {
                    type: 'tool_result' as const,
                    toolUseId: call.id,
                    content: message,
                    isError: true
                },
                events: [
                    {
                        type: 'tool-result' as const,
                        id: call.id,
                        name: call.name,
                        ok: false,
                        durationMs,
                        summary: 'failed',
                        error: message
                    }
                ]
            };
        };

        const tool = ctx.authority.profile.tools.find(
            (entry) => entry.name === call.name
        );
        if (!tool) {
            // A hallucinated name, or one the offer withheld. Both answer
            // "unknown" — which is what the shared registry says too. The tool
            // set is not secret: it is derived from the caller's own role,
            // which they can read off their own profile, so naming it reveals
            // nothing and saves the model a wasted turn. (This used to answer
            // uniformly to avoid an enumeration signal; that reasoning is right
            // for *data* — an ungranted content type still 404s like an unknown
            // one — and wrong for the tool list. ADR-0006 §5 reached the same
            // conclusion for MCP, and one registry should not answer two ways.)
            return fail(`Unknown tool "${call.name}".`);
        }

        // Re-authorize against freshly resolved grants (ADR-0005 §3): the offer
        // was computed at the start of the run, and a role can change while a
        // long turn is in flight.
        const fresh = await this.profiles.resolve(
            {
                id: ctx.input.userId,
                email: ctx.input.userEmail,
                roleId: ctx.input.roleId
            },
            ctx.input.workspaceId,
            ctx.input.signal
        );
        if (!fresh.profile.tools.some((entry) => entry.name === call.name)) {
            this.logger.warn(
                `Run ${ctx.runId}: tool "${call.name}" was offered but is no longer permitted; refused.`
            );
            return fail(`You are not permitted to use "${call.name}".`);
        }

        const validation = validateToolInput(call.input, tool.inputSchema);
        if (!validation.valid) {
            return fail(`Invalid arguments: ${validation.errors.join('; ')}`);
        }

        // The loop guard. A model — especially a smaller local one — will
        // sometimes re-request a call it has already made instead of using the
        // result, and without this the engine obliges every time until it hits
        // `maxSteps`: eight model calls, eight identical queries, no answer, and
        // a stop reason that says nothing about why.
        //
        // Telling it what happened is what actually breaks the loop; silently
        // re-running, or refusing without saying why, both just repeat. Checked
        // AFTER authorization so a repeat can never reveal more than a first
        // call would.
        const signature = `${call.name} ${stableStringify(call.input)}`;
        if (alreadyCalled.has(signature)) {
            this.logger.warn(
                `Run ${ctx.runId}: "${call.name}" repeated with identical arguments; refusing.`
            );
            return fail(
                `You already called "${call.name}" with exactly these arguments in this ` +
                    'conversation, and its result is above. Use that result, or call a ' +
                    'different tool, or answer the question — do not repeat this call.'
            );
        }
        alreadyCalled.add(signature);

        try {
            // Dispatched through the shared registry, not called directly:
            // `ToolRegistry.call` re-checks `requires` before it runs the
            // handler, which is the one authorization point both consumers
            // share (ADR-0006 §5). The offer above is a usability filter; this
            // is the boundary.
            const output = await this.tools.call(
                call.name,
                (call.input ?? {}) as Record<string, unknown>,
                fresh.context,
                'copilot'
            );

            // A `propose` tool's return value IS the change. The engine
            // persists it and (when the workspace opted this tool in) applies
            // it, so ADR-0005 §5's guarantees live in one place instead of
            // once per binder — every proposal is recorded whether or not a
            // human clicks, which is what makes an auto-applied change
            // "undoable, never invisible".
            if (tool.effect === 'propose') {
                return await this.recordProposal(ctx, call, output, startedAt);
            }

            const durationMs = Date.now() - startedAt;
            const summary = summarizeToolOutput(output);

            await this.audit(ctx, call, {
                ok: true,
                error: null,
                durationMs,
                outputSummary: summary
            });

            return {
                block: {
                    type: 'tool_result',
                    toolUseId: call.id,
                    // Fenced as untrusted data: entry bodies are user-authored
                    // and must enter the model as material, never instructions.
                    content: fenceUntrusted(call.name, output)
                },
                events: [
                    {
                        type: 'tool-result',
                        id: call.id,
                        name: call.name,
                        ok: true,
                        durationMs,
                        summary,
                        output
                    }
                ]
            };
        } catch (error) {
            this.logger.warn(
                `Run ${ctx.runId}: tool "${call.name}" threw`,
                error instanceof Error ? error.stack : String(error)
            );
            return fail(userFacingMessage(error));
        }
    }

    /**
     * Persists a `propose` tool's draft, applies it if the workspace opted the
     * tool into auto-apply, and produces both the model's receipt and the
     * client's proposal card.
     *
     * **The model is told about the proposal, not handed the patch back.** It
     * already knows what it asked for; echoing the whole change would spend the
     * tokens twice and invite the model to "confirm" by proposing again. What it
     * needs is the id, the summary, and whether a human still has to accept —
     * which is exactly what makes it say "I've drafted this, accept it below"
     * rather than claiming the edit is done.
     */
    private async recordProposal(
        ctx: {
            input: StartRunInput;
            runId: string;
            conversationId: string;
        },
        call: ToolUseBlock,
        output: unknown,
        startedAt: number
    ): Promise<{ block: ToolResultBlock; events: CopilotRunEvent[] }> {
        // A binder that declared `effect: 'propose'` and returned something
        // else would otherwise write a malformed row into an append-only
        // table. This turns that into an ordinary tool error — the same
        // treatment every other binder bug gets.
        if (!isProposalDraft(output)) {
            const message = `"${call.name}" did not return a valid change.`;
            this.logger.error(
                `Run ${ctx.runId}: propose tool "${call.name}" returned a value ` +
                    'that is not a ProposalDraft; nothing was recorded.'
            );
            const durationMs = Date.now() - startedAt;
            await this.audit(ctx, call, {
                ok: false,
                error: message,
                durationMs,
                outputSummary: null
            });
            return {
                block: {
                    type: 'tool_result',
                    toolUseId: call.id,
                    content: message,
                    isError: true
                },
                events: [
                    {
                        type: 'tool-result',
                        id: call.id,
                        name: call.name,
                        ok: false,
                        durationMs,
                        summary: 'failed',
                        error: message
                    }
                ]
            };
        }

        const draft: ProposalDraft = output;
        let proposal = await this.proposals.create({
            conversationId: ctx.conversationId,
            runId: ctx.runId,
            toolCallId: call.id,
            toolName: call.name,
            kind: draft.kind,
            workspaceId: ctx.input.workspaceId,
            createdBy: ctx.input.userId,
            target: draft.target,
            patch: draft.patch,
            summary: draft.summary,
            ...(draft.changes ? { changes: draft.changes } : {})
        });

        // **Every change applies, immediately** (ADR-0009). The row above is
        // written first regardless, and that ordering is now the only thing
        // carrying ADR-0005 §5's "undoable, never invisible": nothing waits for
        // a human any more, so the receipt is the whole paper trail.
        let applyError: string | undefined;
        const outcome = await this.decisions.apply(proposal, {
            userId: ctx.input.userId,
            email: ctx.input.userEmail,
            workspaceId: ctx.input.workspaceId
        });
        if (outcome.ok) {
            proposal = outcome.proposal;
        } else {
            // The row survives as `pending` with its error recorded. Nobody
            // will retry it — there is no accept endpoint — so this is a
            // receipt saying the change did not happen, and the model is told
            // as much so it can report the failure rather than claim success.
            applyError = outcome.message;
        }

        const durationMs = Date.now() - startedAt;
        const applied = proposal.status === 'accepted';
        const receipt = applied
            ? `Applied: ${draft.summary}`
            : `NOT applied: ${draft.summary}. The change failed and nothing was ` +
              `written (${applyError}). Tell the user it did not happen, and do ` +
              'not claim otherwise.';
        const summary = applied ? 'applied' : 'failed';

        await this.audit(ctx, call, {
            ok: true,
            error: applyError ?? null,
            durationMs,
            outputSummary: `${summary}: ${draft.summary}`
        });

        return {
            block: {
                type: 'tool_result',
                toolUseId: call.id,
                content: fenceUntrusted(call.name, {
                    proposalId: proposal.id,
                    status: proposal.status,
                    message: receipt,
                    ...(applyError ? { applyError } : {})
                })
            },
            events: [
                {
                    type: 'tool-result',
                    id: call.id,
                    name: call.name,
                    ok: true,
                    durationMs,
                    summary,
                    output: {
                        proposalId: proposal.id,
                        status: proposal.status,
                        ...(applyError ? { applyError } : {})
                    }
                },
                {
                    type: 'proposal',
                    id: proposal.id,
                    toolCallId: call.id,
                    toolName: call.name,
                    kind: proposal.kind,
                    summary: proposal.summary,
                    target: proposal.target,
                    ...(proposal.changes ? { changes: proposal.changes } : {}),
                    status: proposal.status,
                    ...(typeof proposal.result?.['entityId'] === 'string'
                        ? { entityId: proposal.result['entityId'] }
                        : {}),
                    // The card has to be able to say the change did not
                    // happen, and this frame is its only chance — there is no
                    // review queue to go and look it up in.
                    ...(applyError ? { error: applyError } : {})
                }
            ]
        };
    }

    /** Writes one `copilot_tool_calls` row. Never fails the run. */
    private async audit(
        ctx: { runId: string; conversationId: string },
        call: ToolUseBlock,
        outcome: {
            ok: boolean;
            error: string | null;
            durationMs: number;
            outputSummary: string | null;
        }
    ): Promise<void> {
        try {
            await this.conversations.recordToolCall({
                conversationId: ctx.conversationId,
                runId: ctx.runId,
                callId: call.id,
                name: call.name,
                input: call.input,
                ...outcome
            });
        } catch (error) {
            // An audit write failing must not take the answer down with it,
            // but it is exactly the kind of thing that has to be loud.
            this.logger.error(
                `Failed to record tool call "${call.name}" for run ${ctx.runId}`,
                error instanceof Error ? error.stack : String(error)
            );
        }
    }

    /** The persisted transcript, as the port's message shape. */
    private async loadHistory(conversationId: string): Promise<ModelMessage[]> {
        const rows = await this.conversations.messages(conversationId);
        return rows.map((row) => ({ role: row.role, content: row.content }));
    }
}

/** The prompt version this engine builds with, for the run record. */
export const ENGINE_PROMPT_VERSION = SYSTEM_PROMPT_VERSION;

/** The provider-facing view of the offered tools. */
function toModelTools(tools: readonly ToolDefinition[]): ModelTool[] {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
    }));
}

/** Input + output across a run. */
function totalTokens(usage: ModelUsage): number {
    return usage.inputTokens + usage.outputTokens;
}

/**
 * JSON with object keys sorted, so two calls that differ only in the order the
 * model happened to emit their arguments compare equal. Without the sort,
 * `{a,b}` and `{b,a}` are different strings and the loop guard misses the
 * repeat it exists to catch.
 */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value) ?? 'null';
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(',')}]`;
    }
    const entries = Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`);
    return `{${entries.join(',')}}`;
}

/**
 * An error reduced to something safe to show a user or feed back to the model
 * — never a stack, a provider payload, or anything naming internal wiring.
 */
function userFacingMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return 'Something went wrong.';
}
