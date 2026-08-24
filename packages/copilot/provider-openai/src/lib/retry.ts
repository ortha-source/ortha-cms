/**
 * The pre-stream retry policy.
 *
 * `provider-anthropic` inherits the vendor SDK's ladder — two attempts on
 * 429/5xx/connection errors, with backoff. This adapter calls `fetch` itself,
 * so it had none: a gateway restarting mid-deploy ended a run with an error
 * frame the user saw. Two adapters behind one port failing differently on the
 * most common transient condition is the divergence ADR-0004 exists to prevent
 * (ORT-147).
 *
 * **Pre-stream only.** A retry is safe exactly while nothing has been yielded:
 * once a `text-delta` has reached the client the engine has already forwarded
 * it to the browser, and re-issuing the request would duplicate or silently
 * replace the answer. That boundary is the one `requestError` already sits on —
 * a failed `fetch`, or a response that never became a body.
 */

/**
 * Statuses worth a second attempt.
 *
 * Everything else is the endpoint's settled answer: a 400 is a malformed
 * request and a 401 a missing key, and repeating either just spends the run's
 * wall clock before reporting the same thing.
 */
const RETRYABLE_STATUSES = new Set([408, 429]);

/** Whether a non-2xx response is transient rather than an answer. */
export function isRetryableStatus(status: number): boolean {
    return RETRYABLE_STATUSES.has(status) || (status >= 500 && status < 600);
}

/** Base backoff, doubled per attempt. */
export const BASE_BACKOFF_MS = 250;

/**
 * The longest this adapter will wait between attempts, and the ceiling a
 * `Retry-After` has to clear.
 *
 * An endpoint asking for more than this is not describing a blip — it is
 * rate-limiting the deployment, and sleeping through the run's whole wall clock
 * would report a timeout instead of the 429 that actually happened. So a longer
 * `Retry-After` ends the ladder rather than being honoured.
 */
export const MAX_RETRY_DELAY_MS = 30_000;

/**
 * Backoff for a zero-based attempt index, with equal jitter.
 *
 * Jittered because every run behind one gateway restarting would otherwise
 * retry in lockstep and hit it again together. Half fixed, half random, so the
 * wait is never effectively zero.
 */
export function backoffDelayMs(attempt: number, random = Math.random): number {
    const ceiling = Math.min(
        BASE_BACKOFF_MS * 2 ** attempt,
        MAX_RETRY_DELAY_MS
    );
    return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

/**
 * Reads `Retry-After`, in either shape the RFC allows — delta-seconds, or an
 * HTTP date.
 *
 * Returns `undefined` when the header is absent or unparseable (fall back to
 * backoff), and a negative-clamped `0` for a date already in the past. `now` is
 * injected so the date branch is testable without freezing the clock.
 */
export function parseRetryAfter(
    header: string | null | undefined,
    now: number = Date.now()
): number | undefined {
    if (!header) return undefined;
    const raw = header.trim();
    if (/^\d+$/.test(raw)) {
        return Number(raw) * 1_000;
    }
    const at = Date.parse(raw);
    if (Number.isNaN(at)) return undefined;
    return Math.max(0, at - now);
}

/**
 * How long to wait before the next attempt, or `undefined` to stop retrying.
 *
 * `Retry-After` wins when the endpoint sent one — it is the only party that
 * knows when the limit resets — unless it is longer than this adapter is
 * willing to wait, which ends the ladder.
 */
export function nextAttemptDelayMs(
    attempt: number,
    retryAfter: string | null | undefined,
    now: number = Date.now(),
    random = Math.random
): number | undefined {
    const requested = parseRetryAfter(retryAfter, now);
    if (requested === undefined) {
        return backoffDelayMs(attempt, random);
    }
    return requested > MAX_RETRY_DELAY_MS ? undefined : requested;
}

/**
 * An abortable sleep.
 *
 * Rejects with the signal's own reason rather than resolving early, so a
 * caller's cancel or the request's timeout firing mid-backoff surfaces as the
 * abort it is — the adapter's existing `catch` then turns it into an `aborted`
 * event or the timeout message, instead of the transient error we were about
 * to retry past.
 */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason);
            return;
        }
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}
