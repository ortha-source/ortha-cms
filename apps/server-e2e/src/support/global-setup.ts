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
    // `E2E_DATABASE_URL` points the run at an already-running Postgres instead
    // of starting a container. Deliberately its OWN variable rather than
    // reusing `DATABASE_URL`: this suite truncates every table between tests,
    // and `DATABASE_URL` is routinely set in a developer's `.env` pointing at
    // their working database. An opt-in name cannot be triggered by accident.
    //
    // The database it names must be disposable. This exists so the suite can
    // run where Docker is unavailable (a sandbox, a Docker-less CI runner);
    // the container remains the default and the thing CI normally uses.
    const external = process.env['E2E_DATABASE_URL'];

    let container: Awaited<ReturnType<PostgreSqlContainer['start']>> | undefined;
    let connectionString: string;

    if (external) {
        console.log('\n[e2e] using E2E_DATABASE_URL (no testcontainer)…');
        connectionString = external;
    } else {
        console.log('\n[e2e] starting Postgres testcontainer…');
        container = await new PostgreSqlContainer('postgres:16-alpine').start();
        connectionString = container.getConnectionUri();
    }

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
    console.log(`[e2e] database ready${container ? ' (testcontainer)' : ''}.\n`);
};
