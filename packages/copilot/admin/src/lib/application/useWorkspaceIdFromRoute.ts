import { useMatch } from 'react-router-dom';

/** Where the workspace shell is mounted. */
const WORKSPACE_ROUTE = '/workspaces/:id/*';

/**
 * The open workspace's id, or `null` outside a workspace.
 *
 * **Why not `useCurrentWorkspace()`.** That hook reads a context
 * `CurrentWorkspaceProvider` supplies, and the provider wraps only the
 * workspace shell's *inset content* — the app sidebar (and therefore
 * `SIDEBAR_FOOTER_SLOT`, where the copilot launcher lives) renders **outside**
 * it. Calling it there doesn't return `null`, it throws: "useCurrentWorkspace
 * must be used inside a WorkspaceShell route", which takes the whole admin down
 * on every page. The sidebar is still inside the router, so the route param is
 * available even where the context is not.
 *
 * The id goes straight into `X-Workspace-Id`, and `WorkspaceGuard` validates it
 * — shape and membership both — so an id read off the URL is no more trusted
 * than one read from context.
 */
export function useWorkspaceIdFromRoute(): string | null {
    const match = useMatch(WORKSPACE_ROUTE);
    return match?.params.id ?? null;
}
