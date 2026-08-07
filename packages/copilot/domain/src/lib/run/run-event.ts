import type { ModelUsage } from '../model/model-provider';
import type { RunStopReason } from './run-limits';

/**
 * The run's opening event, sent before the first model call. It carries the
 * ids the client needs to render and later re-fetch the turn, so a connection
 * that drops mid-answer can still find what was persisted
 * ([`docs/design/copilot.md`](../../../../../docs/design/copilot.md) §5, step 3).
 */
export interface RunStartedEvent {
    type: 'run-started';
    /** The conversation this turn belongs to — newly created, or continued. */
    conversationId: string;
    /** This run's id. Recorded as provenance on every effect. */
    runId: string;
    /** The id of the persisted user message that opened the turn. */
    messageId: string;
}

/** A chunk of the assistant's answer, forwarded the moment it arrives. */
export interface RunTextDeltaEvent {
    type: 'text-delta';
    /** The new text. Concatenating every delta yields the full answer. */
    text: string;
}

/**
 * The copilot is about to run a tool. Emitted **before** execution so the UI
 * can render the step as pending — "no invisible actions" (§2) means the user
 * sees the call even if it then fails or hangs.
 */
export interface RunToolCallEvent {
    type: 'tool-call';
    /** Provider-assigned call id; the matching result echoes it. */
    id: string;
    /** The tool's name, e.g. `content.searchEntries`. */
    name: string;
    /** The arguments the model supplied, already parsed. */
    input: unknown;
}

/** A tool finished — or failed. Always follows its {@link RunToolCallEvent}. */
export interface RunToolResultEvent {
    type: 'tool-result';
    /** The {@link RunToolCallEvent.id} this answers. */
    id: string;
    /** The tool's name, repeated so a client can render without joining. */
    name: string;
    /** Whether the call succeeded. */
    ok: boolean;
    /** How long the call took, in milliseconds. */
    durationMs: number;
    /** One line describing the outcome, e.g. `12 results`. */
    summary: string;
    /** The full result, for the expandable step. Omitted when {@link ok} is false. */
    output?: unknown;
    /** The error message, when {@link ok} is false. */
    error?: string;
}

/** The terminal event. Exactly one of these ends a well-behaved run. */
export interface RunDoneEvent {
    type: 'done';
    /** Why the run ended. */
    stopReason: RunStopReason;
    /** Tokens consumed across every model call in the run. */
    usage: ModelUsage;
    /** The id of the persisted assistant message, when one was written. */
    messageId?: string;
}

/**
 * The run failed. Carries a message safe to show a user — never a stack, a
 * provider payload, or anything naming internal wiring.
 */
export interface RunErrorEvent {
    type: 'error';
    /** What went wrong, in words a user can act on. */
    message: string;
}

/**
 * Everything the engine emits, and exactly what the SSE controller serializes
 * — one event per `data:` frame, with `type` as the SSE event name.
 *
 * The client's reducer is written against this union, so adding an event kind
 * is a compile error at every consumer rather than a silently ignored frame.
 */
export type CopilotRunEvent =
    | RunStartedEvent
    | RunTextDeltaEvent
    | RunToolCallEvent
    | RunToolResultEvent
    | RunDoneEvent
    | RunErrorEvent;
