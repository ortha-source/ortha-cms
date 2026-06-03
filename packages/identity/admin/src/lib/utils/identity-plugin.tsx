import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { IdentityPage } from '../pages/identity-page';

/**
 * Admin-side identity plugin shape. Mirrors `IdentityServerPlugin`; carries no
 * extra fields yet — kept as a named type so future config (slots, nav) has a
 * home.
 */
export type IdentityAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side identity plugin. Contributes the identity-management
 * routes into the admin host's router.
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
        routes: [{ path: '/identity', element: <IdentityPage /> }]
    };
}
