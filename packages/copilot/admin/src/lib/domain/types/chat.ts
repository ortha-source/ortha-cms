/** One tool call as the transcript renders it. */
export interface ChatToolStep {
    /** The provider-assigned call id. */
    id: string;
    /** The tool's name, e.g. `admin_content_search`. */
    name: string;
    /** The arguments the model supplied. */
    input: unknown;
    /** `running` until the result frame lands. */
    status: 'running' | 'ok' | 'error';
    /** One line describing the outcome, e.g. `12 results`. */
    summary?: string;
    /** The full result, shown when the step is expanded. */
    output?: unknown;
    /** The error message, when the call failed. */
    error?: string;
    /** How long it took, in milliseconds. */
    durationMs?: number;
}

/**
 * One change the copilot made, as the transcript renders it.
 *
 * Mirrors the server's `RunProposalEvent`. It lives on the turn rather than in
 * a separate list because a change is *part of an answer* — "here is what I
 * changed" — and pulling it into a list elsewhere would make the reply refer to
 * something off-screen.
 */
export interface ChatProposal {
    /** The persisted proposal's id — what accept/reject address. */
    id: string;
    /** The tool call that produced it, so the card sits with its step. */
    toolCallId: string;
    /** The tool's name, e.g. `content_propose_update`. */
    toolName: string;
    /** Which applier would carry it out, e.g. `content.entry.update`. */
    kind: string;
    /** One line naming the change — the card's title. */
    summary: string;
    /** Where the change lands. */
    target: Record<string, unknown>;
    /** Per-field before/after, when the change is field-shaped. */
    changes?: {
        field: string;
        label?: string;
        before?: unknown;
        after: unknown;
    }[];
    /**
     * `accepted` — the change was made — or `pending`, which now means the
     * apply **failed** (ADR-0009: every change applies as it is drafted, so
     * nothing waits). `rejected` only appears on rows written before that
     * change; nothing produces it now.
     */
    status: 'pending' | 'accepted' | 'rejected';
    /** The entity the change landed on — present only once applied. */
    entityId?: string;
    /** Why the change did not happen, when it didn't. */
    error?: string;
}

/**
 * A tool call parked waiting for the user to allow it.
 *
 * Lives on the turn, like the change card, because it belongs to the answer
 * being written — and unlike the card, it is the one thing in the transcript
 * the run is *blocked* on.
 */
export interface ChatPermissionRequest {
    /** The provider's call id — what a decision addresses. */
    id: string;
    /** The run to answer against. */
    runId: string;
    /** The tool's name, e.g. `content_propose_update`. */
    name: string;
    /** Its human title, when the tool declared one. */
    title?: string;
    /** The arguments the model supplied, shown so the user can judge them. */
    input: unknown;
    /** True while an answer is in flight. */
    deciding?: boolean;
    /** Set when the answer did not reach the run (it had already moved on). */
    error?: string;
    /** True once answered — the prompt stops rendering, the step carries on. */
    answered?: boolean;
}

/**
 * One piece of an assistant turn, in the order it happened.
 *
 * **Order is the point.** These used to be three separate buckets on the turn —
 * every tool step, then all the prose, then every change card — which meant the
 * layout could not say *when* anything occurred. A model that explains, saves,
 * and then keeps writing produced a card pinned to the bottom while new text
 * appeared above it: the transcript showed the change happening after the
 * sentences that were written after it.
 */
export type ChatBlock =
    /** A run of prose. Grows delta by delta while it is the newest block. */
    | { kind: 'text'; id: string; text: string }
    /** A tool call, and its result once it lands. */
    | { kind: 'step'; id: string; step: ChatToolStep }
    /** The receipt for a change, where the change happened. */
    | { kind: 'proposal'; id: string; proposal: ChatProposal };
// Wrapped rather than intersected (`{ kind: 'step' } & ChatToolStep`): a
// proposal already *has* a `kind` — the applier that carried it out,
// `content.entry.update` — and an intersection silently overwrites it with the
// discriminant. The extra `.step` / `.proposal` hop is the price of not
// clobbering a field the card renders.

/** One turn as the transcript renders it. */
export interface ChatMessage {
    /** Stable key. The server's message id once persisted, else a local id. */
    id: string;
    /** Who produced the turn. */
    role: 'user' | 'assistant';
    /**
     * A **user** turn's message — a single string, because a person types one
     * thing. An assistant turn leaves this empty and uses {@link blocks}.
     */
    text: string;
    /**
     * An **assistant** turn's content, in the order the run produced it: prose,
     * tool steps and change cards interleaved rather than sorted into kinds.
     * Empty on a user turn.
     */
    blocks: ChatBlock[];
    /** Tool calls waiting on the user, in order. */
    permissions?: ChatPermissionRequest[];
    /** True while this turn is still streaming. */
    streaming?: boolean;
    /** Why the run ended, once it has. */
    stopReason?: string;
    /** Set when the run failed, and shown in place of an answer. */
    error?: string;
}

/** The panel's whole state. */
export interface ChatState {
    /** The thread being viewed, or `null` for an unsaved new chat. */
    conversationId: string | null;
    /** The transcript, oldest first. */
    messages: ChatMessage[];
    /** True from submit until the `done` frame. */
    busy: boolean;
}
