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
