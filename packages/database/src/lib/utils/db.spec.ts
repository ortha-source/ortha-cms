import {
    closeDatabase,
    DEFAULT_CONNECTION_TIMEOUT_MS,
    DEFAULT_POOL_MAX,
    getDatabase,
    getPool,
    initDatabase
} from './db';
import { Logger } from '@nestjs/common';
import { DatabaseShutdown } from '../database.module';

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

/**
 * The plugin's half of the host's shutdown hooks. `createServer` calls
 * `app.enableShutdownHooks()`, but this package bound nothing to them, so the
 * pool was never `end()`ed. Harmless in the shipped server — it exits
 * immediately and Postgres reaps the backends — but a host that embeds
 * `createServer` and keeps running leaked a pool per app.
 *
 * It is a **provider** rather than a hook on `DatabaseModule` itself because
 * the class carries a bare `@Module({})` as well as its `forRoot()` dynamic
 * form: a plugin writing `imports: [DatabaseModule]` (copilot/server does)
 * gives the container a second host for the same class, and a class-level hook
 * then fired twice for one shutdown.
 */
describe('DatabaseShutdown', () => {
    afterEach(async () => {
        await closeDatabase();
    });

    it('closes the pool and clears the memo', async () => {
        initDatabase({ connectionString: URL_A });
        const pool = getPool();

        await new DatabaseShutdown().onApplicationShutdown();

        expect(pool.ended).toBe(true);
        // Cleared, not just ended: `initDatabase` is idempotent on the memo, so
        // leaving it set would hand the next caller an ended pool and every
        // query after it would throw "Cannot use a pool after calling end".
        expect(() => getPool()).toThrow(
            'Database not initialized. Call initDatabase() first.'
        );
    });

    it('leaves the pool alone while a second application still holds it', async () => {
        // The pool is a process singleton and `initDatabase` is idempotent, so
        // a second app in the same process shares the first's pool rather than
        // opening one. An unconditional close on shutdown therefore ended the
        // database underneath an app that was still answering — and because
        // the memo is cleared too, the survivor failed with "Database not
        // initialized" rather than anything naming the cause. Reproduced by
        // `apps/server-e2e`'s MCP kill-switch case, which boots a second app.
        initDatabase({ connectionString: URL_A });
        initDatabase({ connectionString: URL_A });
        const pool = getPool();

        await new DatabaseShutdown().onApplicationShutdown();

        expect(pool.ended).toBe(false);
        expect(getPool()).toBe(pool);
    });

    it('closes once the last holder shuts down', async () => {
        initDatabase({ connectionString: URL_A });
        initDatabase({ connectionString: URL_A });
        const pool = getPool();

        await new DatabaseShutdown().onApplicationShutdown();
        await new DatabaseShutdown().onApplicationShutdown();

        expect(pool.ended).toBe(true);
        expect(() => getPool()).toThrow(
            'Database not initialized. Call initDatabase() first.'
        );
    });

    it('does not resurrect a closed pool when a stray shutdown arrives', async () => {
        // More releases than inits must not go negative and take the *next*
        // app's pool with it.
        initDatabase({ connectionString: URL_A });
        await new DatabaseShutdown().onApplicationShutdown();
        await new DatabaseShutdown().onApplicationShutdown();

        initDatabase({ connectionString: URL_B });
        const fresh = getPool();
        await new DatabaseShutdown().onApplicationShutdown();

        expect(fresh.ended).toBe(true);
    });

    it('still closes now when a harness asks directly', async () => {
        // `closeDatabase` keeps its unconditional meaning — `closeTestApp`
        // calls it after `app.close()` and expects exactly that.
        initDatabase({ connectionString: URL_A });
        initDatabase({ connectionString: URL_A });
        const pool = getPool();

        await closeDatabase();

        expect(pool.ended).toBe(true);
    });

    it('lets a later init open a genuinely new pool', async () => {
        initDatabase({ connectionString: URL_A });
        await new DatabaseShutdown().onApplicationShutdown();

        initDatabase({ connectionString: URL_B });

        expect(getPool().ended).toBe(false);
    });

    it('is safe when the harness already closed the database', async () => {
        // `apps/server-e2e`'s `closeTestApp` calls `app.close()` and then
        // `closeDatabase()`; both are idempotent, so the hook needs no
        // harness change.
        initDatabase({ connectionString: URL_A });
        await closeDatabase();

        await expect(
            new DatabaseShutdown().onApplicationShutdown()
        ).resolves.toBeUndefined();
    });

    it('never throws out of the hook', async () => {
        // The rest of the teardown still has to run, and the process is going
        // away regardless.
        initDatabase({ connectionString: URL_A });
        const pool = getPool();
        jest.spyOn(pool, 'end').mockRejectedValueOnce(new Error('boom'));
        const logged = jest
            .spyOn(Logger.prototype, 'error')
            .mockImplementation(() => undefined);

        await expect(
            new DatabaseShutdown().onApplicationShutdown()
        ).resolves.toBeUndefined();
        expect(logged).toHaveBeenCalledWith(
            'Failed to close the database pool on shutdown',
            expect.any(String)
        );
        logged.mockRestore();
    });
});
