/**
 * Port that links a newly-invited member to workspaces (memberships). The
 * `workspaces`/`memberships` tables belong to the workspaces context, so this
 * secondary port keeps the users use cases free of that cross-context write;
 * the infrastructure adapter (bound to {@link WORKSPACE_LINKER}) resolves the
 * ids and inserts the links inside the active unit of work.
 */
export interface WorkspaceLinker {
    /**
     * Grants `userId` membership of each workspace in `workspaceIds`. Ids that
     * don't resolve to a real workspace are ignored (so a stale id can't fail
     * the invite), and duplicates are dropped.
     */
    link(userId: string, workspaceIds: string[]): Promise<void>;
}

/** DI token the infrastructure adapter binds to a {@link WorkspaceLinker}. */
export const WORKSPACE_LINKER = Symbol('WORKSPACE_LINKER');
