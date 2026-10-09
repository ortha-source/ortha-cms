import { drizzle } from 'drizzle-orm/node-postgres';
import { PostgresThrottlerStorage } from './postgres-throttler.storage';

/**
 * What can be pinned without a database: that a request is counted by **one**
 * statement — an upsert that decides and writes under its own row lock — and
 * that its answer reaches the throttler in the shape it reads. That the limit
 * then holds across instances is the e2e suite's
 * (`auth/login-throttle-shared.spec.ts`), since it needs a real Postgres.
 */
describe('[identity:I-31] PostgresThrottlerStorage', () => {
    function storage(answer: unknown[] | Error) {
        const statements: { text: string; values?: unknown[] }[] = [];
        const client = {
            query: async (query: { text: string }, values?: unknown[]) => {
                statements.push({ text: query.text, values });
                if (answer instanceof Error) throw answer;
                return { rows: [answer], fields: [] };
            }
        };
        const db = drizzle({ client: client as never });
        return {
            store: new PostgresThrottlerStorage(db as never),
            statements
        };
    }

    it('counts a request with a single upsert, never a read then a write', async () => {
        const { store, statements } = storage([3, 42, false, 0]);

        await store.increment('bucket-key', 60_000, 10, 60_000);

        const counting = statements.filter((s) => !/^delete/i.test(s.text));
        expect(counting).toHaveLength(1);
        const [{ text, values }] = counting;
        expect(text).toMatch(/^insert into "throttle_buckets"/);
        expect(text).toMatch(/on conflict \("key"\) do update set/);
        expect(text).toMatch(/returning/);
        expect(text).not.toMatch(/^select/i);
        expect(values).toEqual(
            expect.arrayContaining(['bucket-key', 60_000, 10])
        );
    });

    it('hands the throttler the record it reads', async () => {
        const { store } = storage([11, 17, true, 45]);

        await expect(store.increment('k', 60_000, 10, 60_000)).resolves.toEqual(
            {
                totalHits: 11,
                timeToExpire: 17,
                isBlocked: true,
                timeToBlockExpire: 45
            }
        );
    });

    it('sweeps finished buckets at most once a minute', async () => {
        const { store, statements } = storage([1, 60, false, 0]);

        await store.increment('a', 60_000, 10, 60_000);
        await store.increment('b', 60_000, 10, 60_000);

        const sweeps = statements.filter((s) =>
            /^delete from "throttle_buckets"/.test(s.text)
        );
        expect(sweeps).toHaveLength(1);
    });
});
