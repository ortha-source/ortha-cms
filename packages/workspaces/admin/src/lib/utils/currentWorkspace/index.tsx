import { createContext, useContext, type ReactNode } from 'react';
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
