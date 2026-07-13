import type { ComponentType, ReactNode } from 'react';
import { createSlot } from '@ortha-cms/utils-admin';

/**
 * A navigation entry in the workspace sidebar's "Workspace" section, rendered
 * as an icon + label row. Unlike the global {@link SidebarItem}, a workspace
 * nav item's `to` is **relative to the current workspace** (e.g. `'media'`,
 * resolved against `/workspaces/:id`) — a contributing plugin never spells out
 * the workspace id. The owning {@link WorkspaceNav} resolves it.
 */
export type WorkspaceNavItem = {
    /** react-intl message id for the label. */
    labelId: string;
    /** Fallback label when no translation is available. */
    defaultLabel: string;
    /**
     * Path relative to the workspace base (`/workspaces/:id`), e.g. `'media'`.
     * No leading slash; it is joined onto the active workspace's base path.
     */
    to: string;
    /** Sort order; lower appears first. */
    order: number;
    /** Leading icon (e.g. a lucide-react icon). */
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
 * content area alongside the workspace sidebar. Its `path` is relative to the
 * workspace base (`/workspaces/:id`), e.g. `'content/*'`. Pair each route with
 * either a {@link WorkspaceNavItem} (a "Workspace" section entry) or a
 * {@link WorkspaceSectionItem} (a custom section, e.g. the content-type list).
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
 * A data-driven section in the workspace sidebar (e.g. the "Content" list of
 * the workspace's content types). Unlike the declarative {@link WorkspaceNavItem},
 * a section is an arbitrary component the contributing plugin renders itself —
 * so it can be backed by a query. Rendered above the "Workspace" section.
 */
export type WorkspaceSectionItem = {
    /** Stable id (also the React key). */
    id: string;
    /** Sort order; lower appears first. */
    order: number;
    /** The section to render. Receives no props — it reads what it needs. */
    Component: ComponentType;
};

/**
 * The "Workspace" section's nav slot — the workspace's utility sections (Media,
 * Insights, Settings), rendered as labeled rows. Any plugin contributes entries
 * via its `slots`; {@link WorkspaceNav} reads it sorted by `order`. (Formerly
 * `WORKSPACE_SIDEBAR_SLOT`.)
 */
export const WORKSPACE_NAV_SLOT = createSlot<WorkspaceNavItem>('workspace.nav');

/**
 * The workspace sidebar's custom-section slot — component-rendered regions
 * above the "Workspace" section. A plugin contributes a
 * {@link WorkspaceSectionItem} via its `slots`; {@link WorkspaceNav} renders
 * them sorted by `order`. The Content Library contributes its content-type list
 * here.
 */
export const WORKSPACE_SECTION_SLOT = createSlot<WorkspaceSectionItem>(
    'workspace.section'
);

/**
 * Workspace route slot — the pages mounted inside the workspace shell. A plugin
 * contributes a {@link WorkspaceRoute} via its `slots`; {@link WorkspaceShell}
 * builds its nested `<Routes>` from them (plus an index redirect to the first
 * route). This is how a feature plugin lives **strictly inside** a workspace: it
 * contributes a route here plus a nav entry or section, and **no** top-level
 * route or sidebar item.
 */
export const WORKSPACE_ROUTE_SLOT =
    createSlot<WorkspaceRoute>('workspace.routes');
