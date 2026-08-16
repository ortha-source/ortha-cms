import {
    closeDatabase,
    DEFAULT_CONNECTION_TIMEOUT_MS,
    DEFAULT_POOL_MAX,
    getDatabase,
    getPool,
    initDatabase
} from './db';

const URL_A = 'postgresql://a:a@127.0.0.1:5432/a';
const URL_B = 'postgresql://b:b@127.0.0.1:5432/b';

/**
 * The connection singleton. `pg` opens no socket until the first query, so all
 * of this runs without a database — which is the point: these are the checks
 * that have to hold *before* anything is reachable.
 */
describe('database connection singleton', () => {
    afterEach(async () => {
        await closeDatabase();
    });

    describe('before initDatabase', () => {
        it('names the mistake instead of returning undefined', () => {
            expect(() => getDatabase()).toThrow(
                'Database not initialized. Call initDatabase() first.'
            );
            expect(() => getPool()).toThrow(
                'Database not initialized. Call initDatabase() first.'
            );
        });
    });

    describe('pool limits', () => {
        it('bounds both the pool size and the wait for a client', () => {
            initDatabase({ connectionString: URL_A });

            const options = getPool().options as {
                max?: number;
                connectionTimeoutMillis?: number;
                statement_timeout?: number | false;
            };
            expect(options.max).toBe(DEFAULT_POOL_MAX);
            // `pg` defaults this to 0, which means wait forever: pool
            // exhaustion then presents as a process that has stopped
            // answering rather than as an error anyone can see.
            expect(options.connectionTimeoutMillis).toBe(
                DEFAULT_CONNECTION_TIMEOUT_MS
            );
            expect(options.statement_timeout).toBeFalsy();
        });

        it('lets a deployment set its own limits', () => {
            initDatabase({
                connectionString: URL_A,
                poolMax: 42,
                connectionTimeoutMillis: 250,
                statementTimeoutMillis: 30_000
            });

            const options = getPool().options as {
                max?: number;
                connectionTimeoutMillis?: number;
                statement_timeout?: number;
            };
            expect(options.max).toBe(42);
            expect(options.connectionTimeoutMillis).toBe(250);
            expect(options.statement_timeout).toBe(30_000);
        });
    });

    describe('idempotency', () => {
        it('keeps the first pool, and silently keeps the first config with it', () => {
            initDatabase({ connectionString: URL_A });
            const first = getPool();

            initDatabase({ connectionString: URL_B, poolMax: 99 });

            expect(getPool()).toBe(first);
            // Worth pinning down because it is a trap rather than a feature: a
            // second `initDatabase` looks like it reconfigures the connection
            // and does nothing at all. A host that wants new settings has to
            // `closeDatabase()` first.
            expect((getPool().options as { max?: number }).max).toBe(
                DEFAULT_POOL_MAX
            );
        });
    });

    describe('closeDatabase', () => {
        it('clears the memo so a later init really opens a new pool', async () => {
            initDatabase({ connectionString: URL_A });
            const first = getPool();

            await closeDatabase();
            initDatabase({ connectionString: URL_B, poolMax: 3 });

            expect(getPool()).not.toBe(first);
            expect((getPool().options as { max?: number }).max).toBe(3);
        });

        it('is a no-op when nothing is open', async () => {
            await expect(closeDatabase()).resolves.toBeUndefined();
            await expect(closeDatabase()).resolves.toBeUndefined();
            expect(() => getPool()).toThrow('Database not initialized');
        });
    });
});
