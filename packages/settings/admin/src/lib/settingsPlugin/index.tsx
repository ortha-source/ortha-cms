import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { SIDEBAR_SECTION_SLOT } from '@ortha-cms/shell-admin';
import { AppLoader } from '@ortha-cms/design-system';
import { ThemeSync } from '../components/ThemeSync';

// Code-split the settings area into its own chunk, fetched only when a signed-in
// user first opens `/settings`.
const SettingsRouter = lazy(() =>
    import('../components/SettingsRouter').then((module) => ({
        default: module.SettingsRouter
    }))
);

/**
 * Admin-side settings plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so future config has a home.
 */
export type SettingsAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side account **Settings** plugin. It owns the private
 * `/settings/*` route (the Preferences tab, where a user picks their colour
 * theme) and contributes an invisible {@link ThemeSync} into the shell's
 * sidebar so the signed-in user's saved theme hydrates the whole app on load.
 *
 * Self-service only — every route reads and writes the *current* user's own
 * preferences, so there is no permission to gate. The entry point is the
 * account menu (a "Preferences" item that links here). Register it after
 * `ShellPlugin()` so the sidebar slot exists.
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [IdentityPlugin(), ShellPlugin(), SettingsPlugin()]
 * });
 * ```
 */
export function SettingsPlugin(): SettingsAdminPlugin {
    return {
        name: 'settings',
        routes: [
            {
                // Splat so the settings shell owns its nested tab routes.
                path: '/settings/*',
                element: (
                    <Suspense fallback={<AppLoader />}>
                        <SettingsRouter />
                    </Suspense>
                )
            }
        ],
        slots: [
            {
                // An always-mounted, invisible theme hydrator — not visible
                // chrome, but the sidebar section slot is the simplest
                // authenticated-and-always-present host for its effect.
                slot: SIDEBAR_SECTION_SLOT,
                items: [
                    {
                        id: 'settings.themeSync',
                        order: 0,
                        Component: ThemeSync
                    }
                ]
            }
        ]
    };
}
