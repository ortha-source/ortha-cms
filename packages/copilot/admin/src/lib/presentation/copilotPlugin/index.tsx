import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';
import { SIDEBAR_FOOTER_SLOT } from '@ortha-cms/shell-admin';
import { CopilotLauncher } from '../CopilotLauncher';

/**
 * Admin-side copilot plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so the panel's future options (default surface, keyboard shortcut) have
 * a home.
 */
export type CopilotAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side copilot plugin.
 *
 * **The chat panel's entry point, and nothing else.** It fills the shell's
 * sidebar footer with a launcher that opens the panel (or `⌘J`) — the panel
 * itself is a docked window over whatever page you are on, which is the point
 * of it being a persistent surface rather than a destination.
 *
 * It contributes **no routes and no nav entry**. It used to contribute one, for
 * the workspace's auto-apply policy, and
 * [ADR-0009](../../../../../../docs/adr/0009-copilot-applies-directly.md)
 * deleted the policy: what the copilot may do is what the caller's role may do,
 * so there is nothing left to configure per workspace and no screen that could
 * honestly be built for it.
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
            }
        ]
    };
}
