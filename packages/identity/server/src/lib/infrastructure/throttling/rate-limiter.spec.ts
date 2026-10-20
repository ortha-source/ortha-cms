import { drizzle } from 'drizzle-orm/node-postgres';
import { RateLimiter } from './rate-limiter';

/**
 * The counting itself is `PostgresThrottlerStorage`'s and has its own spec;
 * what is pinned here is the translation — the key and rule reach the store
 * unchanged, and its record becomes an allow/refuse decision.
 */
describe('RateLimiter', () => {
    function limiter(answer: unknown[]) {
        const statements: { text: string; values?: unknown[] }[] = [];
        const client = {
            query: async (query: { text: string }, values?: unknown[]) => {
                statements.push({ text: query.text, values });
                return { rows: [answer], fields: [] };
            }
        };
        const db = drizzle({ client: client as never });
        return { rateLimiter: new RateLimiter(db as never), statements };
    }

    it('counts the hit against the caller’s own key', async () => {
        const { rateLimiter, statements } = limiter([1, 60, false, 0]);

        await rateLimiter.consume('copilot:runs:user-1', {
            limit: 5,
            windowMs: 60_000
        });

        const [counting] = statements.filter((s) => !/^delete/i.test(s.text));
        expect(counting?.text).toMatch(/^insert into "throttle_buckets"/);
        expect(counting?.values).toEqual(
            expect.arrayContaining(['copilot:runs:user-1', 60_000, 5])
        );
    });

    it('allows a hit the store did not block', async () => {
        const { rateLimiter } = limiter([3, 40, false, 0]);

        await expect(
            rateLimiter.consume('k', { limit: 5, windowMs: 60_000 })
        ).resolves.toEqual({ allowed: true, retryAfterMs: 0 });
    });

    it('refuses a blocked hit and says when to retry', async () => {
        const { rateLimiter } = limiter([6, 40, true, 37]);

        await expect(
            rateLimiter.consume('k', { limit: 5, windowMs: 60_000 })
        ).resolves.toEqual({ allowed: false, retryAfterMs: 37_000 });
    });

    // A block that ends inside the current second rounds to zero in the
    // store; a client honouring `Retry-After: 0` would retry immediately and
    // be refused again.
    it('never asks for a retry sooner than a second', async () => {
        const { rateLimiter } = limiter([6, 0, true, 0]);

        await expect(
            rateLimiter.consume('k', { limit: 5, windowMs: 60_000 })
        ).resolves.toEqual({ allowed: false, retryAfterMs: 1000 });
    });
});
