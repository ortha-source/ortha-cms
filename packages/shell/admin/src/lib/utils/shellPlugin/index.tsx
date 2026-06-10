import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { AuthProvider, RequireAuth } from '@ortha-cms/identity-admin';
import { HomeIcon, UsersIcon } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { HomePage } from '../../pages/HomePage';
import { UsersPage } from '../../pages/UsersPage';
import { NAVBAR_START_SLOT } from '../../slots/navbarSlots';

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
 * Its routes (home, users) carry no `public` flag, so they are private — they
 * render only for signed-in users. It also contributes the toolbar's nav items
 * to its own {@link NAVBAR_START_SLOT}. The Users page is a placeholder until
 * its feature plugin lands, at which point that plugin contributes its own route
 * and nav item and this is removed (as Workspaces already has).
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
            { path: '/users', element: <UsersPage /> }
        ],
        slots: [
            {
                slot: NAVBAR_START_SLOT,
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
