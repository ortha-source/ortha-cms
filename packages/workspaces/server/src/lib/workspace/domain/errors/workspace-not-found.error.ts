/** Raised when an operation targets a workspace id that doesn't exist. */
export class WorkspaceNotFoundError extends Error {
    constructor(public readonly workspaceId: string) {
        super(`Workspace not found: ${workspaceId}`);
        this.name = 'WorkspaceNotFoundError';
    }
}
