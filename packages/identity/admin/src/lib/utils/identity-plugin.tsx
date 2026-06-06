import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { IdentityRouter } from '../router';
import { AuthProvider } from '../auth/AuthProvider';

/**
 * Admin-side identity plugin shape. Mirrors `IdentityServerPlugin`; carries no
 * extra fields yet — kept as a named type so future config (slots, nav) has a
 * home.
 */
export type IdentityAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side identity plugin. It does two things:
 *
 * - **Provides auth state.** Its `provider` ({@link AuthProvider}) fetches
 *   `GET /api/auth/me` and publishes the current user into the host's auth
 *   context, so the host can gate every private route.
 * - **Mounts the auth screens.** A single wildcard route `/identity/*` whose
 *   nested router owns the sub-paths; today it serves the login UI at
 *   `/identity/signin`. The route is `public` — sign-in must be reachable while
 *   logged out, so it sits outside the authenticated shell.
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
        provider: AuthProvider,
        routes: [
            { path: '/identity/*', element: <IdentityRouter />, public: true }
        ]
    };
}
