import type { ComponentType, ReactNode } from 'react';
import { createSlot } from '@ortha-cms/utils-admin';

/**
 * A navigation entry rendered as an icon button in the workspace's left rail.
 * Unlike the shell's top-toolbar {@link NavbarItem}, a workspace nav item's
 * `to` is **relative to the current workspace** (e.g. `'content'`, resolved
 * against `/workspaces/:id`) — a contributing plugin never spells out the
 * workspace id. The owning {@link WorkspaceShell} resolves it.
 */
export type WorkspaceNavItem = {
    /** react-intl message id for the label (shown in the tooltip + as `aria-label`). */
    labelId: string;
    /** Fallback label when no translation is available. */
    defaultLabel: string;
    /**
     * Path relative to the workspace base (`/workspaces/:id`), e.g. `'content'`.
     * No leading slash; it is joined onto the active workspace's base path.
     */
    to: string;
    /** Sort order; lower appears first (top of the rail, or leftmost in the footer). */
    order: number;
    /** Leading icon (e.g. a lucide-react icon) — the rail is icon-only. */
    icon: ComponentType<{ className?: string }>;
    /**
     * Optional permission key required to see this entry. When set, the entry
     * is hidden from users whose role doesn't grant it (the UI mirror of the
     * linked route's server-side gate). Omit for an entry visible to every
     * member (the default — the linked page still gates itself).
     */
    permission?: string;
};

/**
 * A route mounted **inside** the workspace shell, rendered in the shell's
 * content area alongside the left rail. Its `path` is relative to the workspace
 * base (`/workspaces/:id`), e.g. `'content/*'`. Pair each route with a
 * {@link WorkspaceNavItem} contributing the rail button that links to it.
 */
export type WorkspaceRoute = {
    /**
     * Path relative to the workspace base, e.g. `'content/*'`. Use a trailing
     * `/*` when the page mounts its own nested routes.
     */
    path: string;
    /** Element rendered at that path (wrap lazy pages in `<Suspense>`). */
    element: ReactNode;
};

/**
 * The rail's section-nav slot — the workspace's sections, rendered as icon
 * buttons below the workspace switcher. Any plugin contributes entries via its
 * `slots`; {@link WorkspaceShell} reads it sorted by `order`. Content Library,
 * Media Library, Insights, and Settings all live here.
 */
export const WORKSPACE_SIDEBAR_SLOT = createSlot<WorkspaceNavItem>(
    'workspace.sidebar.start'
);

/**
 * Workspace route slot — the pages mounted inside the workspace shell. A plugin
 * contributes a {@link WorkspaceRoute} via its `slots`; {@link WorkspaceShell}
 * builds its nested `<Routes>` from them (plus an index redirect to the first
 * rail entry). This is how a feature plugin lives **strictly inside** a
 * workspace: it contributes a rail button + a route here and **no** top-level
 * route or navbar item.
 */
export const WORKSPACE_ROUTE_SLOT =
    createSlot<WorkspaceRoute>('workspace.routes');
