import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * The Drizzle client type this plugin exposes — the single source of truth
 * for "what the db client is". Consumers (other plugins, services) annotate
 * injected clients with this, never the dialect-specific `NodePgDatabase`,
 * so a dialect change (e.g. to MySQL) is a one-line edit **here** rather
 * than a sweep across every consumer.
 */
export type Database = NodePgDatabase;

/**
 * Configuration for the database plugin.
 */
export interface DatabasePluginConfig {
    /** PostgreSQL connection string. */
    connectionString: string;
}
