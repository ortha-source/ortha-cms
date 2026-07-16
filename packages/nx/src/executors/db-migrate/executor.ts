import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { applyPluginMigrations } from '../../lib/drizzle/apply';
import { createTsJiti } from '../../lib/jiti';

/** Options for the `db-migrate` executor. */
export interface DbMigrateExecutorOptions {
    /** Path to the host's ortha.config.ts (relative to the workspace root). */
    config: string;
    /** Path to the module exporting buildPlugins(config) (relative to root). */
    plugins: string;
}

/** Minimal shape this executor needs from the host config. */
interface HostConfig {
    database: { url: string };
    [key: string]: unknown;
}

/**
 * Applies all plugin migrations for a host project. Loads the host's
 * ortha.config.ts and its buildPlugins() factory (both TypeScript, loaded
 * via jiti + swc), constructs the plugin list, and applies each plugin's
 * migrations. Side-effecting — never cached.
 */
export default async function dbMigrateExecutor(
    options: DbMigrateExecutorOptions,
    context: ExecutorContext
): Promise<{ success: boolean }> {
    const jiti = createTsJiti(__filename);

    const configModule = await jiti.import<{ default: HostConfig }>(
        join(context.root, options.config)
    );
    const config = configModule.default;

    const pluginsModule = await jiti.import<{
        buildPlugins: (config: HostConfig) => ServerPlugin[];
    }>(join(context.root, options.plugins));

    const plugins = pluginsModule.buildPlugins(config);
    await applyPluginMigrations(plugins, config.database.url);

    return { success: true };
}
