import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { NAVBAR_START_SLOT } from '@ortha-cms/shell-admin';
import { Spinner } from '@ortha-cms/design-system';
import { Users } from 'lucide-react';

// Lazy-loaded so the Members page is code-split into its own chunk, fetched
// only when a signed-in user first navigates to `/users`.
const MembersPage = lazy(() =>
    import('../../pages/MembersPage').then((module) => ({
        default: module.MembersPage
    }))
);

/**
 * Admin-side users plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config (sub-routes, slots) has a home.
 */
export type UsersAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side users plugin. It owns the members feature: the
 * private `/users` route (the Members page, rendered inside the shell's
 * authenticated layout) and its toolbar nav entry, contributed to the shell's
 * {@link NAVBAR_START_SLOT} at `order: 30` (after Workspaces). The page itself
 * gates on the `users:read` permission.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *     ShellPlugin(),
 *     WorkspacesPlugin(),
 *     UsersPlugin(),
 *   ],
 * });
 * ```
 */
export function UsersPlugin(): UsersAdminPlugin {
    return {
        name: 'users',
        routes: [
            {
                path: '/users',
                element: (
                    <Suspense fallback={<Spinner />}>
                        <MembersPage />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                slot: NAVBAR_START_SLOT,
                items: [
                    {
                        labelId: 'users.nav.label',
                        defaultLabel: 'Members',
                        to: '/users',
                        order: 30,
                        icon: Users
                    }
                ]
            }
        ]
    };
}
