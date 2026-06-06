import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { AppShell } from '../components/AppShell';
import { HomePage } from '../pages/HomePage';

/**
 * Admin-side shell plugin shape. A thin alias of {@link AdminPlugin}, kept named
 * so future config (nav items, slots) has a home.
 */
export type ShellAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side shell plugin. It contributes the authenticated app
 * chrome via `layout` ({@link AppShell}) — the host mounts it as the single
 * guarded parent of every private route — and the home page at `/`. Both are
 * private: with no `public` flag, the home route renders only for signed-in
 * users, inside the shell's outlet.
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
        layout: <AppShell />,
        routes: [{ path: '/', element: <HomePage /> }]
    };
}
