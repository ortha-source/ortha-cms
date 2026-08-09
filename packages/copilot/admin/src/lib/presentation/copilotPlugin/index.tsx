import { Suspense, lazy } from 'react';
import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { SIDEBAR_FOOTER_SLOT } from '@ortha-cms/shell-admin';
import {
    WORKSPACE_NAV_SLOT,
    WORKSPACE_ROUTE_SLOT
} from '@ortha-cms/workspaces-admin';
import { Sparkles } from 'lucide-react';
import { CopilotLauncher } from '../CopilotLauncher';

const CopilotSettingsPage = lazy(() =>
    import('../../pages/CopilotSettingsPage').then((module) => ({
        default: module.CopilotSettingsPage
    }))
);

/**
 * Admin-side copilot plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so the panel's future options (default surface, keyboard shortcut) have
 * a home.
 */
export type CopilotAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side copilot plugin.
 *
 * **The chat panel's entry point, plus the settings page.** It fills the
 * shell's sidebar footer with a launcher that opens the panel (or `⌘J`) — the
 * panel itself is a docked window over whatever page you are on, which is the
 * point of it being a persistent surface rather than a destination.
 *
 * The one route it does contribute is the workspace's **auto-apply policy**
 * (ADR-0005 §6), which is a destination: it is configuration, it is per
 * workspace, and it is read rarely by one person rather than constantly by
 * everyone. Its nav entry carries `permission: 'copilot:configure'`, so an
 * editor never sees a link to a page that would 403 — the page gates itself as
 * well, since a nav entry is a courtesy and not a boundary.
 *
 * The launcher renders nothing outside a workspace and nothing without
 * `copilot:use`, so registering it globally costs nothing where it doesn't
 * apply.
 *
 * Register it **after** `ShellPlugin()` (whose slot it fills) and
 * `WorkspacesPlugin()` (whose current-workspace context it reads).
 *
 * @example
 * ```typescript
 * createAdmin({
 *   plugins: [
 *     IdentityPlugin(),
 *     ShellPlugin(),
 *     WorkspacesPlugin(),
 *     CopilotPlugin(),
 *   ],
 * });
 * ```
 */
export function CopilotPlugin(): CopilotAdminPlugin {
    return {
        name: 'copilot',
        slots: [
            {
                slot: SIDEBAR_FOOTER_SLOT,
                // Before the account menu (which sits at a higher order): the
                // copilot is a tool you reach for, not an identity control.
                items: [
                    { id: 'copilot', order: 10, Component: CopilotLauncher }
                ]
            },
            {
                slot: WORKSPACE_NAV_SLOT,
                items: [
                    {
                        labelId: 'copilot.nav.label',
                        defaultLabel: 'Ortha AI',
                        to: 'copilot',
                        // After Insights (30) and before Settings: it is
                        // configuration, but of a feature rather than of the
                        // workspace itself.
                        order: 35,
                        icon: Sparkles,
                        iconColor: 'text-nav-violet',
                        permission: 'copilot:configure'
                    }
                ]
            },
            {
                slot: WORKSPACE_ROUTE_SLOT,
                items: [
                    {
                        path: 'copilot/*',
                        element: (
                            <Suspense fallback={null}>
                                <CopilotSettingsPage />
                            </Suspense>
                        )
                    }
                ]
            }
        ]
    };
}
