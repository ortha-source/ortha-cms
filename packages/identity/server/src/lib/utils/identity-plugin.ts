import { join } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import type { IdentityPluginConfig } from '../types';
import { IdentityModule } from '../identity.module';
import { SESSION_COOKIE } from '../auth/services/cookie.service';

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
 * the `plugins` array — identity is DB-backed and injects the client from
 * `@orthacms/database`'s global `DatabaseModule`, which must be wired
 * first.
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
        identityConfig: config,
        migrations: {
            // Lazy — only called at migrate time, never at boot. Source
            // layout: src/lib/utils → ../../../migrations = <pkg>/migrations.
            // When this package is BUILT/published, switch to a package-root
            // anchor (dirname(require.resolve('@orthacms/identity-server/package.json'))).
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_identity'
        },
        // Identity owns the app's authentication, so it is also the plugin that
        // tells the OpenAPI document how a caller proves who they are. Both
        // schemes are offered document-wide: `@Public()` routes (login) simply
        // ignore them.
        docs: {
            securitySchemes: {
                session: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: SESSION_COOKIE,
                    description:
                        'Opaque session cookie issued by `POST /api/auth/login`. Sent automatically by the browser; the global `AuthGuard` resolves it to the current user.'
                },
                apiToken: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'orthacms_<random>',
                    description:
                        'External API token minted by `POST /api/api-tokens`, shown once at mint time. Scoped to one or more workspaces; a request picks which one it targets with the `X-Workspace-Id` header (optional when the token covers exactly one). Authenticates the public content API (`/api/v1/...`).'
                }
            },
            defaultSecurity: ['session', 'apiToken']
        }
    };
}
