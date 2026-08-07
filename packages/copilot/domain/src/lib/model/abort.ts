import type { DoneEvent } from './model-provider';

/**
 * Whether a thrown error is the cancellation the caller asked for rather than
 * a real failure. Checks the signal first: a provider that observes its own
 * abort may surface it as any error type, and an aborted signal is a more
 * reliable witness than an error's `name`.
 */
export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    return error instanceof Error && error.name === 'AbortError';
}

/**
 * The terminal event every adapter emits when the caller cancels — the port's
 * contract is that an abort *ends* the stream rather than throwing out of it.
 *
 * Usage is zero by design: a cancelled call never reaches a usage record we
 * can trust, and inventing one would corrupt cost accounting.
 */
export function abortedEvent(): DoneEvent {
    return {
        type: 'done',
        stopReason: 'aborted',
        usage: { inputTokens: 0, outputTokens: 0 }
    };
}
