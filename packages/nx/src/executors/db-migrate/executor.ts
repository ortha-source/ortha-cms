import { join } from 'node:path';
import type { ExecutorContext } from '@nx/devkit';
import { createJiti } from 'jiti';
import { transformSync } from '@swc/core';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import { applyPluginMigrations } from '../../lib/drizzle/apply';

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
 * jiti transform hook delegating to swc. Loading `buildPlugins` pulls in the
 * plugin graph (NestJS modules, their DTOs), which uses **legacy** decorators
 * (`experimentalDecorators`). jiti's bundled babel ignores our tsconfig and
 * defaults to the stage-3 decorator semantics, which give a decorated
 * definite-assignment field (`email!: string`) an initializer and then crash
 * in `transform-typescript`. swc with `legacyDecorator` matches the repo's
 * actual TS config, so the same source the app compiles loads here too.
 */
function swcTransform(opts: { source: string; filename?: string }): {
    code: string;
    error?: unknown;
} {
    try {
        const { code } = transformSync(opts.source, {
            filename: opts.filename ?? 'module.ts',
            configFile: false,
            swcrc: false,
            jsc: {
                target: 'es2022',
                parser: { syntax: 'typescript', decorators: true },
                transform: {
                    legacyDecorator: true,
                    decoratorMetadata: true
                }
            },
            module: { type: 'commonjs' }
        });
        return { code };
    } catch (error) {
        return { error, code: opts.source };
    }
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
    const jiti = createJiti(__filename, { transform: swcTransform });

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
