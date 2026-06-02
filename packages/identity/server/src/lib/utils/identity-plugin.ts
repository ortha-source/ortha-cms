import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { IdentityPluginConfig } from '../types';
import { IdentityModule } from '../identity.module';

/**
 * Server plugin for identity, carrying its config alongside the standard
 * plugin shape.
 */
export interface IdentityServerPlugin extends ServerPlugin {
    /** Identity configuration. */
    identityConfig: IdentityPluginConfig;
}

/**
 * Creates the identity plugin. Register it **after** `DatabasePlugin` in
 * the `plugins` array — identity is DB-backed and assumes a live
 * connection. Role seeding (FR-6) and first-admin bootstrap (FR-10) will
 * attach to `onPluginInit` once those tickets (#6, #16) land.
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *     IdentityPlugin(config.plugins.identity),
 *   ],
 * });
 * ```
 */
export function IdentityPlugin(
    config: IdentityPluginConfig
): IdentityServerPlugin {
    return {
        name: 'identity',
        module: IdentityModule.forRoot(config),
        identityConfig: config
    };
}
