/**
 * Raised when a workspace can't be deleted because it still holds content
 * entries. Deleting would orphan those records (they're workspace-scoped by a
 * plain uuid with no FK, so a cascade can't reach them), so a delete is only
 * allowed once every content type in the workspace is empty.
 */
export class WorkspaceNotEmptyError extends Error {
    constructor(
        public readonly workspaceId: string,
        public readonly entryCount: number
    ) {
        super(
            `Workspace ${workspaceId} still has ${entryCount} content entr${
                entryCount === 1 ? 'y' : 'ies'
            }`
        );
        this.name = 'WorkspaceNotEmptyError';
    }
}
