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
 * **Phase 1 contributes one thing: the chat panel's entry point.** It fills the
 * shell's sidebar footer with a launcher that opens the panel (or `⌘J`), and
 * contributes no routes — the panel is a sheet over whatever page you are on,
 * which is the whole point of it being a persistent surface rather than a
 * destination.
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
