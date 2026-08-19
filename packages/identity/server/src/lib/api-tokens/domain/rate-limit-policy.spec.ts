import { RateLimitPolicy } from './rate-limit-policy';

const WINDOW_MS = 60_000;

/** A three-per-minute budget — small enough that every boundary is visible. */
const policy = () => new RateLimitPolicy({ windowMs: WINDOW_MS, limit: 3 });

describe('RateLimitPolicy', () => {
    describe('counting', () => {
        it('opens a window on the first request of an unseen token', () => {
            const decision = policy().consume(undefined, 1_000);

            expect(decision.allowed).toBe(true);
            expect(decision.remaining).toBe(2);
            expect(decision.window).toEqual({ startedAt: 1_000, count: 1 });
            expect(decision.resetAt).toBe(1_000 + WINDOW_MS);
        });

        it('spends the budget down to zero, then refuses', () => {
            const p = policy();
            let window = undefined as
                | ReturnType<typeof p.consume>['window']
                | undefined;
            const remaining: number[] = [];

            for (let i = 0; i < 4; i += 1) {
                const decision = p.consume(window, 1_000);
                window = decision.window;
                remaining.push(decision.remaining);
                expect(decision.allowed).toBe(i < 3);
            }

            expect(remaining).toEqual([2, 1, 0, 0]);
        });

        it('does not count a refused request against the window', () => {
            // Otherwise a client that keeps hammering through its own 429s
            // inflates a number nobody reads — and, under any scheme that
            // resets from the last request, would push its reset out forever.
            const p = policy();
            const spent = { startedAt: 1_000, count: 3 };

            const first = p.consume(spent, 2_000);
            const second = p.consume(first.window, 3_000);

            expect(first.window).toEqual(spent);
            expect(second.window).toEqual(spent);
        });
    });

    describe('the window boundary', () => {
        it('keeps counting inside the window', () => {
            const decision = policy().consume(
                { startedAt: 1_000, count: 1 },
                1_000 + WINDOW_MS - 1
            );

            expect(decision.window).toEqual({ startedAt: 1_000, count: 2 });
        });

        it('opens a fresh window the instant the old one elapses', () => {
            const at = 1_000 + WINDOW_MS;
            const decision = policy().consume(
                { startedAt: 1_000, count: 3 },
                at
            );

            expect(decision.allowed).toBe(true);
            expect(decision.window).toEqual({ startedAt: at, count: 1 });
        });

        it('never penalises an idle token for an old burst', () => {
            const decision = policy().consume(
                { startedAt: 1_000, count: 3 },
                1_000 + WINDOW_MS * 100
            );

            expect(decision.allowed).toBe(true);
            expect(decision.remaining).toBe(2);
        });
    });

    describe('retry advice', () => {
        it('rounds the wait up to whole seconds', () => {
            const decision = policy().consume(
                { startedAt: 0, count: 3 },
                WINDOW_MS - 1_500
            );

            expect(decision.retryAfterSeconds).toBe(2);
        });

        it('never advertises a zero-second wait', () => {
            // `Retry-After: 0` reads as "retry immediately", which is the
            // opposite of what a refusal means — the floor is one second even
            // when the window is a millisecond from resetting.
            const decision = policy().consume(
                { startedAt: 0, count: 3 },
                WINDOW_MS - 1
            );

            expect(decision.retryAfterSeconds).toBe(1);
        });
    });

    describe('disabled', () => {
        it('allows everything when the limit is zero', () => {
            const p = new RateLimitPolicy({ windowMs: WINDOW_MS, limit: 0 });

            expect(p.enabled).toBe(false);
            expect(
                p.consume({ startedAt: 0, count: 9_999 }, 1_000).allowed
            ).toBe(true);
        });

        it('reports an infinite remainder, so no header claims a budget', () => {
            const p = new RateLimitPolicy({ windowMs: WINDOW_MS, limit: 0 });

            expect(p.consume(undefined, 1_000).remaining).toBe(
                Number.POSITIVE_INFINITY
            );
        });
    });

    describe('expiry', () => {
        it('reports a window as expired exactly once it has elapsed', () => {
            const p = policy();
            const window = { startedAt: 1_000, count: 1 };

            expect(p.isExpired(window, 1_000 + WINDOW_MS - 1)).toBe(false);
            expect(p.isExpired(window, 1_000 + WINDOW_MS)).toBe(true);
        });
    });
});
