import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { IdentityPluginConfig, IdentityPluginDeps } from '../types';
import { IdentityModule } from '../identity.module';
import { seedSystemRoles } from '../rbac/seed-system-roles';

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
 * connection. The host supplies a `getDb` accessor (§5); identity never
 * imports `@ortha-cms/database`.
 *
 * On `onPluginInit` it idempotently seeds the system roles (FR-6). The
 * hook runs after `DatabasePlugin.onPluginInit` (plugins run in array
 * order), so the connection is already open. First-admin bootstrap
 * (FR-10) attaches here once #16 lands.
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *     IdentityPlugin(config.plugins.identity, { getDb: () => getDatabase() }),
 *   ],
 * });
 * ```
 */
export function IdentityPlugin(
    config: IdentityPluginConfig,
    deps: IdentityPluginDeps
): IdentityServerPlugin {
    return {
        name: 'identity',
        module: IdentityModule.forRoot(config, deps),
        identityConfig: config,
        async onPluginInit() {
            await seedSystemRoles(deps.getDb());
        },
        migrations: {
            // Lazy — only called at migrate time, never at boot. Source
            // layout: src/lib/utils → ../../../migrations = <pkg>/migrations.
            // When this package is BUILT/published, switch to a package-root
            // anchor (dirname(require.resolve('@ortha-cms/identity-server/package.json'))).
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_identity'
        }
    };
}
