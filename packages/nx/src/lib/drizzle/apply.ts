import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';

/**
 * Applies every registered plugin's shipped migrations. Each plugin is
 * tracked in its own table so plugins version independently. Source
 * plugins and npm-installed plugins go through the identical path — each
 * just advertises its own `migrations.dir`.
 */
export async function applyPluginMigrations(
    plugins: ServerPlugin[],
    databaseUrl: string
): Promise<void> {
    const withMigrations = plugins.filter((plugin) => plugin.migrations);

    if (withMigrations.length === 0) {
        console.log('No plugin migrations to apply.');
        return;
    }

    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);

    try {
        for (const plugin of withMigrations) {
            const migrations = plugin.migrations;
            if (!migrations) {
                continue;
            }
            console.log(`Applying migrations: ${plugin.name} → ${migrations.table}`);
            await migrate(db, {
                migrationsFolder: migrations.dir(),
                migrationsTable: migrations.table
            });
        }
        console.log('Migrations complete.');
    } finally {
        await pool.end();
    }
}
