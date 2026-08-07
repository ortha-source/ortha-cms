import type { AdminPlugin } from '@ortha-cms/bootstrap-admin';

/**
 * Admin-side copilot plugin shape. A thin alias of {@link AdminPlugin}, kept
 * named so the chat panel's future options (default surface, keyboard
 * shortcut) have a home.
 */
export type CopilotAdminPlugin = AdminPlugin;

/**
 * Creates the admin-side copilot plugin.
 *
 * **Phase 0 contributes nothing yet** — no routes, no slots, no chrome. It
 * exists so the host's plugin list, its TypeScript project references, and the
 * package graph are already in place when the chat panel lands, making that
 * change a UI change rather than a wiring change.
 *
 * Register it **after** `ShellPlugin()` and `WorkspacesPlugin()`: the panel
 * mounts into the workspace shell's sidebar footer, so it is a workspace-shell
 * slot filler like the other workspace-interior features.
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
    return { name: 'copilot' };
}
