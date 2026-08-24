import {
    BASE_BACKOFF_MS,
    MAX_RETRY_DELAY_MS,
    backoffDelayMs,
    delay,
    isRetryableStatus,
    nextAttemptDelayMs,
    parseRetryAfter
} from './retry';

/**
 * The retry *policy*, separated from the adapter that applies it: what counts
 * as transient, how long to wait, and when to stop waiting altogether. The
 * provider spec covers the other half — that the ladder only ever runs before
 * the first event.
 */
describe('isRetryableStatus', () => {
    it('retries the transient statuses', () => {
        expect(isRetryableStatus(408)).toBe(true);
        expect(isRetryableStatus(429)).toBe(true);
        expect(isRetryableStatus(500)).toBe(true);
        expect(isRetryableStatus(502)).toBe(true);
        expect(isRetryableStatus(599)).toBe(true);
    });

    it('treats a 4xx answer as settled', () => {
        // Repeating a malformed request or a missing key just spends the run's
        // wall clock before reporting the same thing.
        expect(isRetryableStatus(400)).toBe(false);
        expect(isRetryableStatus(401)).toBe(false);
        expect(isRetryableStatus(404)).toBe(false);
        expect(isRetryableStatus(422)).toBe(false);
    });
});

describe('backoffDelayMs', () => {
    it('doubles per attempt and keeps half the wait fixed', () => {
        // Equal jitter: the floor is what stops a "backoff" of ~0ms.
        expect(backoffDelayMs(0, () => 0)).toBe(BASE_BACKOFF_MS / 2);
        expect(backoffDelayMs(0, () => 0.999)).toBeLessThanOrEqual(
            BASE_BACKOFF_MS
        );
        expect(backoffDelayMs(1, () => 0)).toBe(BASE_BACKOFF_MS);
        expect(backoffDelayMs(2, () => 0)).toBe(BASE_BACKOFF_MS * 2);
    });

    it('never exceeds the ceiling, however many attempts in', () => {
        expect(backoffDelayMs(40, () => 0.999)).toBeLessThanOrEqual(
            MAX_RETRY_DELAY_MS
        );
    });
});

describe('parseRetryAfter', () => {
    it('reads delta-seconds', () => {
        expect(parseRetryAfter('3')).toBe(3_000);
        expect(parseRetryAfter(' 12 ')).toBe(12_000);
    });

    it('reads an HTTP date, relative to now', () => {
        const now = Date.parse('2026-01-01T00:00:00Z');
        expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:05 GMT', now)).toBe(
            5_000
        );
    });

    it('clamps a date already in the past to zero', () => {
        const now = Date.parse('2026-01-01T00:00:10Z');
        expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0);
    });

    it('is undefined when absent or unreadable, so backoff applies', () => {
        expect(parseRetryAfter(null)).toBeUndefined();
        expect(parseRetryAfter(undefined)).toBeUndefined();
        expect(parseRetryAfter('')).toBeUndefined();
        expect(parseRetryAfter('soon')).toBeUndefined();
    });
});

describe('nextAttemptDelayMs', () => {
    it('prefers the endpoint’s own Retry-After', () => {
        // It is the only party that knows when its limit resets.
        expect(nextAttemptDelayMs(0, '2', Date.now(), () => 0)).toBe(2_000);
    });

    it('falls back to backoff when the header is absent', () => {
        expect(nextAttemptDelayMs(1, null, Date.now(), () => 0)).toBe(
            BASE_BACKOFF_MS
        );
    });

    it('stops retrying when the endpoint asks for longer than we will wait', () => {
        // Sleeping an hour would report a timeout instead of the 429 that
        // actually happened.
        const requested = String(MAX_RETRY_DELAY_MS / 1_000 + 1);
        expect(
            nextAttemptDelayMs(0, requested, Date.now(), () => 0)
        ).toBeUndefined();
    });
});

describe('delay', () => {
    it('resolves after the wait', async () => {
        const controller = new AbortController();
        await expect(delay(1, controller.signal)).resolves.toBeUndefined();
    });

    it('rejects immediately on an already-aborted signal', async () => {
        const controller = new AbortController();
        controller.abort(new Error('gone'));
        await expect(delay(10_000, controller.signal)).rejects.toThrow('gone');
    });

    it('rejects with the signal’s reason when it aborts mid-wait', async () => {
        const controller = new AbortController();
        const pending = delay(10_000, controller.signal);
        controller.abort(new Error('cancelled'));
        // The adapter's own catch turns this back into an `aborted` event or
        // the timeout message — never into "retrying past" the failure.
        await expect(pending).rejects.toThrow('cancelled');
    });
});
