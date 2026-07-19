/* eslint-disable */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { buildTestPlugins } from './plugins';
import { buildTestConfig } from './test-config';
import { publishDatabaseUrl } from './db-url';

/**
 * One Postgres testcontainer for the whole e2e run, migrated once with the
 * per-plugin migration descriptors from {@link buildTestPlugins}. We apply each
 * plugin's `migrations` ({ dir, table }) exactly as `server:db:migrate` does, so
 * the schema under test is the real shipped schema for every plugin — except
 * content, whose tables come from the e2e-owned model (`src/support/content`),
 * decoupling the run from `apps/server`'s collections.
 *
 * The container handle is stashed on `globalThis` for teardown; the
 * connection string is published for the worker via {@link publishDatabaseUrl}.
 */
module.exports = async function () {
    console.log('\n[e2e] starting Postgres testcontainer…');
    const container = await new PostgreSqlContainer(
        'postgres:16-alpine'
    ).start();
    const connectionString = container.getConnectionUri();

    // Apply every plugin's migrations against the fresh container. We build the
    // plugin list from the e2e factory so order and descriptors match the boot;
    // only the migration metadata is consumed here.
    const plugins = buildTestPlugins(buildTestConfig(connectionString));
    const pool = new Pool({ connectionString });
    try {
        const db = drizzle(pool);
        for (const plugin of plugins) {
            if (!plugin.migrations) continue;
            console.log(`[e2e] migrating "${plugin.name}"…`);
            await migrate(db, {
                migrationsFolder: plugin.migrations.dir(),
                migrationsTable: plugin.migrations.table
            });
        }
    } finally {
        await pool.end();
    }

    publishDatabaseUrl(connectionString);
    (globalThis as any).__PG_CONTAINER__ = container;
    console.log('[e2e] testcontainer ready.\n');
};
