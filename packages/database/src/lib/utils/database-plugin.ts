import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { DatabasePluginConfig } from '../types';
import { DatabaseModule } from '../database.module';
import { initDatabase } from './db';

/**
 * Server plugin for the database, carrying its config alongside the
 * standard plugin shape.
 */
export interface DatabaseServerPlugin extends ServerPlugin {
    /** Database configuration. */
    databaseConfig: DatabasePluginConfig;
}

/**
 * Creates the database plugin. The connection is opened eagerly in
 * `onPluginInit` (before the Nest app is created), so list it first in
 * the `plugins` array — every other plugin can then assume a live db.
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *   ],
 * });
 * ```
 */
export function DatabasePlugin(
    config: DatabasePluginConfig
): DatabaseServerPlugin {
    return {
        name: 'database',
        module: DatabaseModule.forRoot(),
        databaseConfig: config,
        onPluginInit() {
            initDatabase(config);
        }
    };
}
