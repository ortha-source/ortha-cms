import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { NAVBAR_END_SLOT, NAVBAR_START_SLOT } from '@ortha-cms/shell-admin';
import { Users } from 'lucide-react';
import {
    InviteMemberPageSkeleton,
    MembersPageSkeleton
} from '../../components/MembersSkeleton';
import { AccountMenu } from '../../components/AccountMenu';

// Lazy-loaded so the Members page is code-split into its own chunk, fetched
// only when a signed-in user first navigates to `/users`.
const MembersPage = lazy(() =>
    import('../../pages/MembersPage').then((module) => ({
        default: module.MembersPage
    }))
);

const InviteMemberPage = lazy(() =>
    import('../../pages/InviteMemberPage').then((module) => ({
        default: module.InviteMemberPage
    }))
);

// The detail page (its nested tab router) is its own chunk, fetched only when a
// member row is opened.
const UserDetailRouter = lazy(() =>
    import('../../components/UserDetailRouter').then((module) => ({
        default: module.UserDetailRouter
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
                    <Suspense fallback={<MembersPageSkeleton />}>
                        <MembersPage />
                    </Suspense>
                )
            },
            {
                path: '/users/invite',
                element: (
                    <Suspense fallback={<InviteMemberPageSkeleton />}>
                        <InviteMemberPage />
                    </Suspense>
                )
            },
            {
                // Splat so the detail page owns its nested tab routes
                // (`general`, `roles`, …). `/users/invite` outranks `/users/:id`
                // in the router, so the static invite route is unaffected.
                path: '/users/:id/*',
                element: (
                    <Suspense fallback={<MembersPageSkeleton />}>
                        <UserDetailRouter />
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
            },
            {
                // The account menu in the toolbar's trailing region.
                slot: NAVBAR_END_SLOT,
                items: [
                    {
                        id: 'users.account',
                        order: 10,
                        Component: AccountMenu
                    }
                ]
            }
        ]
    };
}
