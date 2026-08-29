/**
 * What to do with the result of one delivery attempt, and when to try again.
 *
 * Pure and framework-free so the two decisions that actually matter — "is this
 * worth retrying?" and "how long until the next one?" — are unit-testable
 * without a server, a socket or a clock.
 */

/** How many attempts a delivery gets before it is given up on. */
export const DEFAULT_MAX_ATTEMPTS = 6;

/**
 * The gap before each attempt, in milliseconds.
 *
 * Roughly nine hours end to end — long enough to cover a receiver's overnight
 * outage, short enough that a delivery does not linger for days pretending it
 * might still land. Index `n` is the wait **after** attempt `n + 1` failed.
 */
export const RETRY_SCHEDULE_MS: readonly number[] = [
    10_000,
    60_000,
    5 * 60_000,
    30 * 60_000,
    2 * 60 * 60_000,
    6 * 60 * 60_000
];

/** Ceiling on a `Retry-After` we will honour, so a receiver cannot park us. */
export const MAX_RETRY_AFTER_MS = 60 * 60_000;

/** How much random spread is applied to a scheduled wait, as a fraction. */
export const JITTER_RATIO = 0.2;

/** What one attempt's outcome means for the delivery. */
export type DeliveryVerdict =
    /** 2xx — done. */
    | { outcome: 'succeeded' }
    /** Worth another attempt, optionally at a receiver-requested time. */
    | { outcome: 'retry'; retryAfterMs?: number }
    /** Never going to succeed; stop now rather than spending five more attempts. */
    | { outcome: 'dead'; reason: string };

/**
 * Classifies an HTTP response.
 *
 * `408` and `429` are retried because they describe a moment, not the request.
 * Every other `4xx` is fatal on purpose: a rejected body or a wrong path is not
 * going to be accepted on the sixth attempt, and hammering a receiver that
 * already said "no" for nine hours is the behaviour that gets a sender
 * blocklisted.
 */
export function classifyStatus(
    status: number,
    retryAfterMs?: number
): DeliveryVerdict {
    if (status >= 200 && status < 300) return { outcome: 'succeeded' };

    if (status === 408 || status === 429) {
        return retryAfterMs === undefined
            ? { outcome: 'retry' }
            : {
                  outcome: 'retry',
                  retryAfterMs: Math.min(retryAfterMs, MAX_RETRY_AFTER_MS)
              };
    }

    if (status >= 400 && status < 500) {
        return {
            outcome: 'dead',
            reason: `Receiver rejected the delivery with HTTP ${status}.`
        };
    }

    // 5xx, and anything else a server can put on the wire.
    return { outcome: 'retry' };
}

/**
 * Parses a `Retry-After` header — either a delta in seconds or an HTTP date —
 * into milliseconds from `now`. Returns `undefined` for anything unparseable or
 * already in the past.
 */
export function parseRetryAfter(
    header: string | null | undefined,
    now: Date = new Date()
): number | undefined {
    if (!header) return undefined;

    const trimmed = header.trim();
    if (/^\d+$/.test(trimmed)) {
        return Number(trimmed) * 1000;
    }

    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return undefined;

    const delta = at - now.getTime();
    return delta > 0 ? delta : undefined;
}

/**
 * When the delivery that has now failed `attempts` times may be tried again.
 *
 * Jittered by ±20 % so a receiver coming back after an outage is not hit by the
 * whole accumulated backlog on the same tick — the retries that were scheduled
 * together would otherwise stay together for every subsequent round.
 *
 * `random` is injectable purely so the jitter is testable; production passes
 * nothing and gets `Math.random`.
 */
export function nextAttemptDelayMs(
    attempts: number,
    random: () => number = Math.random
): number {
    const index = Math.min(
        Math.max(attempts - 1, 0),
        RETRY_SCHEDULE_MS.length - 1
    );
    const base = RETRY_SCHEDULE_MS[index];
    const spread = base * JITTER_RATIO;
    // random() in [0, 1) → offset in [-spread, +spread).
    return Math.max(0, Math.round(base + (random() * 2 - 1) * spread));
}

/** Whether `attempts` failures exhaust the budget of `maxAttempts`. */
export function isExhausted(
    attempts: number,
    maxAttempts: number = DEFAULT_MAX_ATTEMPTS
): boolean {
    return attempts >= maxAttempts;
}
