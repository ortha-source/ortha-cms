import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { IdentityRouter } from '../router';

/**
 * Admin-side identity plugin shape. Mirrors `IdentityServerPlugin`; carries no
 * extra fields yet — kept as a named type so future config (slots, nav) has a
 * home.
 */
export type IdentityAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side identity plugin. Mounts the identity router under the
 * `/identity` base path; today it serves the login UI at `/identity/signin`.
 * The route is a wildcard (`/identity/*`) so the plugin's nested router owns
 * its sub-paths.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *   ],
 * });
 * ```
 */
export function IdentityPlugin(): IdentityAdminPlugin {
    return {
        name: 'identity',
        routes: [{ path: '/identity/*', element: <IdentityRouter /> }]
    };
}
