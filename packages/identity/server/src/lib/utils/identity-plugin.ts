import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { IdentityPluginConfig, IdentityPluginDeps } from '../types';
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
 * connection. The host passes `deps.dbToken` (the DI token its db client
 * resolves under, §5); identity never imports `@ortha-cms/database`.
 *
 * System-role seeding (FR-6) runs from a NestJS `OnApplicationBootstrap`
 * hook in `SystemRolesSeeder`, where the client is injected via DI — not
 * from the pre-app `onPluginInit`. First-admin bootstrap (FR-10) follows
 * the same pattern once #16 lands.
 *
 * @example
 * ```typescript
 * createServer({
 *   plugins: [
 *     DatabasePlugin({ connectionString: config.database.url }),
 *     IdentityPlugin(config.plugins.identity, { dbToken: DATABASE_TOKEN }),
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
