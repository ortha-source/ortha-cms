import {
    MAX_RETRY_AFTER_MS,
    RETRY_SCHEDULE_MS,
    classifyStatus,
    isExhausted,
    nextAttemptDelayMs,
    parseRetryAfter
} from './retry-policy';

describe('classifyStatus', () => {
    it.each([200, 201, 202, 204, 299])('treats %i as success', (status) => {
        expect(classifyStatus(status)).toEqual({ outcome: 'succeeded' });
    });

    it.each([500, 502, 503, 504])('retries %i', (status) => {
        expect(classifyStatus(status).outcome).toBe('retry');
    });

    it.each([408, 429])(
        'retries %i — it describes a moment, not the request',
        (status) => {
            expect(classifyStatus(status).outcome).toBe('retry');
        }
    );

    it.each([400, 401, 403, 404, 410, 422])(
        'gives up on %i rather than spending five more attempts',
        (status) => {
            const verdict = classifyStatus(status);
            expect(verdict.outcome).toBe('dead');
            if (verdict.outcome === 'dead') {
                expect(verdict.reason).toContain(String(status));
            }
        }
    );

    it('honours a Retry-After on a 429', () => {
        expect(classifyStatus(429, 30_000)).toEqual({
            outcome: 'retry',
            retryAfterMs: 30_000
        });
    });

    it('caps a Retry-After so a receiver cannot park us for a day', () => {
        expect(classifyStatus(429, 24 * 60 * 60_000)).toEqual({
            outcome: 'retry',
            retryAfterMs: MAX_RETRY_AFTER_MS
        });
    });
});

describe('parseRetryAfter', () => {
    const now = new Date('2026-08-29T10:00:00.000Z');

    it('reads a delta in seconds', () => {
        expect(parseRetryAfter('120', now)).toBe(120_000);
    });

    it('reads an HTTP date', () => {
        expect(parseRetryAfter('Sat, 29 Aug 2026 10:02:00 GMT', now)).toBe(
            120_000
        );
    });

    it('ignores a date already in the past', () => {
        expect(
            parseRetryAfter('Sat, 29 Aug 2026 09:00:00 GMT', now)
        ).toBeUndefined();
    });

    it.each([null, undefined, '', 'soon'])('ignores %p', (header) => {
        expect(parseRetryAfter(header, now)).toBeUndefined();
    });
});

describe('nextAttemptDelayMs', () => {
    it('follows the schedule when the jitter is neutral', () => {
        // random() === 0.5 puts the offset at exactly zero.
        expect(nextAttemptDelayMs(1, () => 0.5)).toBe(RETRY_SCHEDULE_MS[0]);
        expect(nextAttemptDelayMs(3, () => 0.5)).toBe(RETRY_SCHEDULE_MS[2]);
    });

    it('stays within ±20% of the scheduled wait', () => {
        for (const random of [() => 0, () => 0.999999]) {
            const delay = nextAttemptDelayMs(2, random);
            expect(delay).toBeGreaterThanOrEqual(RETRY_SCHEDULE_MS[1] * 0.8);
            expect(delay).toBeLessThanOrEqual(RETRY_SCHEDULE_MS[1] * 1.2);
        }
    });

    it('spreads a backlog rather than releasing it on one tick', () => {
        const values = new Set(
            Array.from({ length: 50 }, () => nextAttemptDelayMs(1))
        );
        expect(values.size).toBeGreaterThan(1);
    });

    it('clamps past the end of the schedule instead of reading undefined', () => {
        expect(nextAttemptDelayMs(99, () => 0.5)).toBe(
            RETRY_SCHEDULE_MS[RETRY_SCHEDULE_MS.length - 1]
        );
    });

    it('clamps a zeroth attempt to the first step', () => {
        expect(nextAttemptDelayMs(0, () => 0.5)).toBe(RETRY_SCHEDULE_MS[0]);
    });
});

describe('isExhausted', () => {
    it('is false while attempts remain', () => {
        expect(isExhausted(5, 6)).toBe(false);
    });

    it('is true once the budget is spent', () => {
        expect(isExhausted(6, 6)).toBe(true);
    });
});
