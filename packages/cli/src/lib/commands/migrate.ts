import { applyPluginMigrations } from '../migrate';
import { loadHost, requireDatabaseUrl } from '../project';
import { buildCommand } from './build';

/**
 * Applies every registered plugin's pending migrations.
 *
 * Builds the server first. Migrating is the one command whose input is the
 * app's *own* TypeScript — the plugin list, and the order it is in — and a
 * stale `dist/` would silently migrate against the previous composition: a
 * plugin added an hour ago simply would not have its tables created, and
 * nothing would say so. The compile is incremental and costs about a second.
 */
export async function migrateCommand(root: string): Promise<void> {
    await buildCommand(root, { serverOnly: true });

    const { config, plugins } = loadHost(root);

    await applyPluginMigrations(plugins, requireDatabaseUrl(config));
}
