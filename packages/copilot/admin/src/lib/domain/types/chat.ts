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
 * One proposed change as the transcript renders it.
 *
 * Mirrors the server's `RunProposalEvent` plus a client-only `deciding` flag.
 * It lives on the turn rather than in a separate list because a proposal is
 * *part of an answer* — "here is what I would change" — and pulling it into a
 * queue elsewhere would make the reply refer to something off-screen.
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
    /** `pending`, or `accepted` when auto-apply carried it out already. */
    status: 'pending' | 'accepted' | 'rejected';
    /** The entity the change landed on — present only once applied. */
    entityId?: string;
    /**
     * True when the change was applied **without** anyone clicking — the
     * workspace opted this tool in.
     *
     * Derived at arrival rather than read off the row: the server records the
     * same `decidedBy` either way, because auto-apply acts as the user whose run
     * produced it. What distinguishes them is that an auto-applied proposal
     * arrives *already* accepted, which only the client that watched it arrive
     * can know. It matters because "you applied this" and "this was applied for
     * you" are different things to tell someone.
     */
    autoApplied?: boolean;
    /** True while an accept or reject is in flight. */
    deciding?: boolean;
    /** Why the last decision failed, when one did. */
    error?: string;
}

/** One turn as the transcript renders it. */
export interface ChatMessage {
    /** Stable key. The server's message id once persisted, else a local id. */
    id: string;
    /** Who produced the turn. */
    role: 'user' | 'assistant';
    /** The prose. Grows delta by delta while an answer streams. */
    text: string;
    /** Tool calls made during this turn, in order. */
    steps: ChatToolStep[];
    /** Changes proposed during this turn, in order. */
    proposals?: ChatProposal[];
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
