import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { setActiveWorkspaceId } from '@ortha-cms/utils-admin';
import type { Workspace } from '../../types/workspace';

/**
 * The workspace currently open in the shell. Provided by {@link WorkspaceShell}
 * once it has resolved the `:id` route param against the workspaces list, and
 * read by any page or rail button mounted inside the shell via
 * {@link useCurrentWorkspace} — so a feature plugin never has to re-read the
 * `:id` param or re-fetch the workspace itself.
 */
const CurrentWorkspaceContext = createContext<Workspace | null>(null);

type CurrentWorkspaceProviderProps = {
    /** The resolved workspace to expose to the subtree. */
    workspace: Workspace;
    children: ReactNode;
};

/** Provides the open workspace to everything rendered inside the shell. */
export function CurrentWorkspaceProvider({
    workspace,
    children
}: CurrentWorkspaceProviderProps) {
    // Sync the shared apiClient's workspace header during render — the parent
    // renders before its children, so the header is set before any child's
    // data hook fires its first request (a useEffect here runs *after* those
    // child effects, leaving the first request unscoped). Idempotent.
    setActiveWorkspaceId(workspace.id);

    // Re-assert on mount and clear on unmount. The render-time set above wins the
    // first-paint race, but under StrictMode (and any future double-invoke) React
    // runs setup → cleanup → setup; without re-setting here the interim cleanup
    // would leave the header null for the rest of the session — every
    // workspace-scoped request then 400s ("Missing X-Workspace-Id"). Keyed on the
    // id so switching workspaces re-scopes; clears only on real unmount.
    useEffect(() => {
        setActiveWorkspaceId(workspace.id);
        return () => setActiveWorkspaceId(null);
    }, [workspace.id]);

    return (
        <CurrentWorkspaceContext.Provider value={workspace}>
            {children}
        </CurrentWorkspaceContext.Provider>
    );
}

/**
 * Returns the workspace currently open in the shell. Throws when called outside
 * a {@link WorkspaceShell} — a workspace page is always mounted inside one, so a
 * missing provider is a wiring bug, not a runtime state to handle.
 */
export function useCurrentWorkspace(): Workspace {
    const workspace = useContext(CurrentWorkspaceContext);
    if (!workspace) {
        throw new Error(
            'useCurrentWorkspace must be used inside a WorkspaceShell route.'
        );
    }
    return workspace;
}
