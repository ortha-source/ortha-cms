import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { AuthProvider, RequireAuth } from '@ortha-cms/identity-admin';
import { HomeIcon, LayoutGridIcon, UsersIcon } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { HomePage } from '../../pages/HomePage';
import { WorkspacesPage } from '../../pages/WorkspacesPage';
import { UsersPage } from '../../pages/UsersPage';
import { NAV_ITEM_SLOT } from '../../slots/navItemSlot';

/**
 * Admin-side shell plugin shape. A thin alias of {@link AdminPlugin}, kept named
 * so future config (nav items, slots) has a home.
 */
export type ShellAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side shell plugin. It contributes the authenticated app
 * chrome via `layout` and the home page at `/`. The host mounts the `layout` as
 * the single parent of every private route, so the shell owns the gating: it
 * wraps {@link AppShell} in identity's {@link RequireAuth} (the gate) inside
 * {@link AuthProvider} (the auth-state source). Private routes render in the
 * shell's outlet, behind that one check; the host stays auth-agnostic.
 *
 * Its routes (home, workspaces, users) carry no `public` flag, so they are
 * private — they render only for signed-in users. It also contributes the
 * toolbar's nav items to its own {@link NAV_ITEM_SLOT}. The Workspaces/Users
 * pages are placeholders until their feature plugins land, at which point those
 * plugins contribute their own routes and nav items and these are removed.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *     ShellPlugin(),
 *   ],
 * });
 * ```
 */
export function ShellPlugin(): ShellAdminPlugin {
    return {
        name: 'shell',
        layout: (
            <AuthProvider>
                <RequireAuth>
                    <AppShell />
                </RequireAuth>
            </AuthProvider>
        ),
        routes: [
            { path: '/', element: <HomePage /> },
            { path: '/workspaces', element: <WorkspacesPage /> },
            { path: '/users', element: <UsersPage /> }
        ],
        slots: [
            {
                slot: NAV_ITEM_SLOT,
                items: [
                    {
                        labelId: 'shell.nav.home',
                        defaultLabel: 'Home',
                        to: '/',
                        end: true,
                        order: 10,
                        icon: HomeIcon
                    },
                    {
                        labelId: 'shell.nav.workspaces',
                        defaultLabel: 'Workspaces',
                        to: '/workspaces',
                        order: 20,
                        icon: LayoutGridIcon
                    },
                    {
                        labelId: 'shell.nav.users',
                        defaultLabel: 'Users',
                        to: '/users',
                        order: 30,
                        icon: UsersIcon
                    }
                ]
            }
        ]
    };
}
