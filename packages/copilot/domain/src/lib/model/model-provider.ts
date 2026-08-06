import type { ModelCapabilities } from './model-capabilities';
import type { ModelMessage, ModelTool } from './model-message';

/** One model call: the prompt, the tools on offer, and the output ceiling. */
export interface ModelRequest {
    /**
     * Provider-specific model id, e.g. `claude-opus-5` or `llama3.1`. Omit to
     * use the provider's configured default — the usual case, since the model
     * is a deployment choice rather than a per-run one.
     */
    model?: string;
    /** The system prompt. Assembled by the engine, never user-authored. */
    system?: string;
    /** The conversation so far, oldest first. */
    messages: readonly ModelMessage[];
    /**
     * Tools this run may invoke — already filtered to the caller's capability
     * profile, because a tool the model was never told about cannot be
     * requested ([ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §3).
     */
    tools?: readonly ModelTool[];
    /** Hard ceiling on the response, in tokens. */
    maxOutputTokens: number;
}

/** Tokens consumed by one model call — the input to cost and quota accounting. */
export interface ModelUsage {
    /** Tokens billed as input, excluding anything served from a cache. */
    inputTokens: number;
    /** Tokens the model generated. */
    outputTokens: number;
    /** Input tokens served from a provider-side prompt cache, when reported. */
    cachedInputTokens?: number;
}

/** Why the model stopped generating. */
export type ModelStopReason =
    /** A complete answer. */
    | 'end'
    /** The model wants one or more tools run before continuing. */
    | 'tool_use'
    /** Hit {@link ModelRequest.maxOutputTokens} — the answer is truncated. */
    | 'max_tokens'
    /** The provider's safety classifiers declined the request. */
    | 'refusal'
    /** The caller aborted via the signal passed to {@link ModelProvider.stream}. */
    | 'aborted';

/** A chunk of the answer, forwarded to the client as it arrives. */
export interface TextDeltaEvent {
    type: 'text-delta';
    /** The new text. Concatenating every delta yields the full answer. */
    text: string;
}

/**
 * A complete tool call. Providers buffer partial argument JSON internally and
 * emit this only once the arguments parse — the engine never sees half a call.
 */
export interface ToolCallEvent {
    type: 'tool-call';
    /** Provider-assigned id, echoed back on the tool result. */
    id: string;
    /** The requested tool's name. */
    name: string;
    /** Parsed arguments. Validated against the tool's schema by the engine. */
    input: unknown;
}

/** The terminal event. Exactly one of these ends a well-behaved stream. */
export interface DoneEvent {
    type: 'done';
    /** Why generation stopped. */
    stopReason: ModelStopReason;
    /** Tokens consumed by this call. */
    usage: ModelUsage;
}

/**
 * The normalised event stream every adapter produces. Two wire formats, two
 * tool-call encodings and two usage shapes collapse to this one vocabulary, so
 * the engine never branches per vendor.
 */
export type ModelStreamEvent = TextDeltaEvent | ToolCallEvent | DoneEvent;

/**
 * The model boundary. Implementations live in separate packages
 * (`@ortha-cms/copilot-provider-anthropic`,
 * `@ortha-cms/copilot-provider-openai-compatible`,
 * `@ortha-cms/copilot-provider-fake`) and are registered at the composition
 * root. The copilot core depends only on this interface — **never** on a
 * vendor SDK
 * ([ADR-0004](../../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §1).
 */
export interface ModelProvider {
    /**
     * What this provider's configured model can do. Async because an adapter
     * may probe a live endpoint (a local runtime's `/models`) rather than
     * answer from a table.
     */
    capabilities(): Promise<ModelCapabilities>;
    /**
     * Runs one model call, yielding normalised events. Aborting `signal` must
     * end the iteration promptly; a provider that observes the abort emits a
     * `done` event with `stopReason: 'aborted'` rather than throwing.
     */
    stream(
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent>;
}

/** What the core knows about a run when choosing a provider. */
export interface ModelRunContext {
    /** The workspace the run is scoped to. */
    workspaceId: string;
    /** The user the run acts as — the copilot has no identity of its own. */
    userId: string;
}

/** The named providers available to route between. */
export interface ModelRegistry {
    /** Resolves a provider by name; throws if the name isn't registered. */
    get(name: string): ModelProvider;
    /** Whether a provider is registered under `name`. */
    has(name: string): boolean;
    /** Every registered provider name. */
    names(): string[];
}

/** DI token the composition root binds to the {@link ModelRegistry}. */
export const MODEL_REGISTRY = Symbol('MODEL_REGISTRY');

/**
 * The optional custom handler that picks WHICH registered provider serves a
 * given run — full custom code, returning a provider NAME present in the
 * registry. If the host supplies none, the core uses
 * `config.defaultProvider` for every run.
 */
export type ModelResolver = (
    ctx: ModelRunContext,
    providers: ModelRegistry
) => string;

/** DI token the composition root binds to the {@link ModelResolver}. */
export const MODEL_RESOLVER = Symbol('MODEL_RESOLVER');
