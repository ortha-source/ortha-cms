import { MAX_DELIVERY_ATTEMPTS, nextAttemptAfter } from './outbox-dispatcher';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const delayAfter = (attempts: number) =>
    nextAttemptAfter(attempts, NOW).getTime() - NOW.getTime();

/**
 * The retry schedule. It is the half of the retry ceiling that decides whether
 * the ceiling protects anything: drains are triggered by commits, so without a
 * delay a busy server would spend every attempt in milliseconds and park events
 * whose subscriber was merely restarting.
 */
describe('nextAttemptAfter', () => {
    it('waits a second after the first failure', () => {
        expect(delayAfter(1)).toBe(1_000);
    });

    it('doubles with each further failure', () => {
        expect(delayAfter(2)).toBe(2_000);
        expect(delayAfter(3)).toBe(4_000);
        expect(delayAfter(4)).toBe(8_000);
        expect(delayAfter(8)).toBe(128_000);
    });

    it('plateaus at five minutes rather than running away', () => {
        expect(delayAfter(9)).toBe(256_000);
        expect(delayAfter(MAX_DELIVERY_ATTEMPTS)).toBe(300_000);
        expect(delayAfter(100)).toBe(300_000);
    });

    it('gives a row roughly half an hour before it is a dead letter', () => {
        const total = Array.from({ length: MAX_DELIVERY_ATTEMPTS }, (_, i) =>
            delayAfter(i + 1)
        ).reduce((sum, delay) => sum + delay, 0);

        expect(total).toBeGreaterThan(20 * 60_000);
        expect(total).toBeLessThan(60 * 60_000);
    });

    it('never schedules a retry in the past', () => {
        for (let attempts = 1; attempts <= MAX_DELIVERY_ATTEMPTS; attempts++) {
            expect(nextAttemptAfter(attempts, NOW).getTime()).toBeGreaterThan(
                NOW.getTime()
            );
        }
    });
});
