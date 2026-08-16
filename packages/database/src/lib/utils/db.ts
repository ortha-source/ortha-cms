import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Database, DatabasePluginConfig } from '../types';

let pool: Pool | null = null;
let database: Database | null = null;

/**
 * Initializes the connection pool and Drizzle ORM instance.
 * Idempotent — a second call is a no-op. Must run before
 * {@link getDatabase} or {@link getPool}.
 */
export function initDatabase(config: DatabasePluginConfig): void {
    if (database) {
        return;
    }

    pool = new Pool({ connectionString: config.connectionString });
    database = drizzle(pool);
}

/**
 * Closes the pool and clears the memo, so a later {@link initDatabase} opens a
 * genuinely new connection.
 *
 * Ending the pool without clearing the memo is the trap this exists to close:
 * `initDatabase` is idempotent on `database`, so the next call would return
 * early and hand back the **ended** pool, and every query after it would throw
 * "Cannot use a pool after calling end on the pool" — a message that names
 * neither the caller nor the cause. Idempotent: closing twice is a no-op.
 */
export async function closeDatabase(): Promise<void> {
    const current = pool;
    pool = null;
    database = null;
    await current?.end();
}

/**
 * Returns the initialized Drizzle ORM instance.
 * Throws if {@link initDatabase} has not been called.
 */
export function getDatabase(): Database {
    if (!database) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return database;
}

/**
 * Returns the underlying pg Pool.
 * Throws if {@link initDatabase} has not been called.
 */
export function getPool(): Pool {
    if (!pool) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return pool;
}
