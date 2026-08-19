import { ApiTokenRateLimiter } from './api-token-rate-limiter';
import { ApiTokenRateLimitException } from './api-token-rate-limit.exception';
import { RateLimitPolicy } from '../domain/rate-limit-policy';

const WINDOW_MS = 60_000;

const limiter = (limit = 3) =>
    new ApiTokenRateLimiter(
        new RateLimitPolicy({ windowMs: WINDOW_MS, limit })
    );

describe('ApiTokenRateLimiter', () => {
    it('gives each token its own bucket', () => {
        // The credential is the unit of fairness: one integration looping is
        // not allowed to refuse another's requests, which is the whole reason
        // the key is the token rather than the workspace or the address.
        const rateLimiter = limiter();

        rateLimiter.assert('token-a', 'A', 1_000);
        rateLimiter.assert('token-a', 'A', 1_000);
        rateLimiter.assert('token-a', 'A', 1_000);

        expect(rateLimiter.consume('token-a', 1_000).allowed).toBe(false);
        expect(rateLimiter.consume('token-b', 1_000).allowed).toBe(true);
    });

    it('throws a 429 carrying the retry advice once the budget is spent', () => {
        const rateLimiter = limiter(1);
        rateLimiter.assert('token-a', 'A', 1_000);

        let thrown: unknown;
        try {
            rateLimiter.assert('token-a', 'A', 1_000);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toBeInstanceOf(ApiTokenRateLimitException);
        const exception = thrown as ApiTokenRateLimitException;
        expect(exception.getStatus()).toBe(429);
        expect(exception.decision.retryAfterSeconds).toBe(60);
        // The token's NAME, so an operator reading the 429 knows which
        // credential to raise or split — not its id, and not an address.
        expect(exception.getResponse()).toMatchObject({
            message: expect.stringContaining('(A)')
        });
    });

    it('lets a token through again once its window has elapsed', () => {
        const rateLimiter = limiter(1);
        rateLimiter.assert('token-a', 'A', 1_000);

        expect(() => rateLimiter.assert('token-a', 'A', 1_000)).toThrow();
        expect(rateLimiter.consume('token-a', 1_000 + WINDOW_MS).allowed).toBe(
            true
        );
    });

    it('is inert when the limit is disabled', () => {
        const rateLimiter = limiter(0);

        expect(rateLimiter.enabled).toBe(false);
        for (let i = 0; i < 50; i += 1) {
            expect(rateLimiter.assert('token-a', 'A', 1_000).allowed).toBe(
                true
            );
        }
    });

    it('evicts elapsed windows rather than growing forever', () => {
        // Cardinality is bounded by the number of minted credentials — but a
        // long-lived process with thousands of rotated tokens should not keep
        // a window for every one of them it has ever seen.
        const rateLimiter = limiter();
        const windows = () =>
            (rateLimiter as unknown as { windows: Map<string, unknown> })
                .windows.size;

        for (let i = 0; i < 300; i += 1) {
            rateLimiter.consume(`token-${i}`, 1_000);
        }
        expect(windows()).toBe(300);

        // One request a window later: the sweep runs and drops every window
        // that has elapsed, leaving only the one just opened.
        rateLimiter.consume('token-fresh', 1_000 + WINDOW_MS);
        expect(windows()).toBe(1);
    });

    it('does not sweep on every request', () => {
        // The sweep walks the whole map, so doing it per request would put an
        // O(tokens) loop on the hot path of every public-API call.
        const rateLimiter = limiter();
        const windows = () =>
            (rateLimiter as unknown as { windows: Map<string, unknown> })
                .windows.size;

        for (let i = 0; i < 300; i += 1) {
            rateLimiter.consume(`token-${i}`, 1_000);
        }
        rateLimiter.consume('token-0', 2_000);

        expect(windows()).toBe(300);
    });
});
