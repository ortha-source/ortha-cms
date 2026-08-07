/** One tool call as the transcript renders it. */
export interface ChatToolStep {
    /** The provider-assigned call id. */
    id: string;
    /** The tool's name, e.g. `content.searchEntries`. */
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
