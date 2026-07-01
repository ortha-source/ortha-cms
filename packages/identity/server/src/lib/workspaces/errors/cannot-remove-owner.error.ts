/**
 * Raised when removing the workspace owner's membership. The owner is recorded
 * on `workspaces.owner_user_id` and is un-removable — they must be replaced (or
 * the workspace deleted) rather than left owner-less by dropping their
 * membership. Mirrors the admin, which pins the owner row.
 */
export class CannotRemoveOwnerError extends Error {
    constructor(
        public readonly workspaceId: string,
        public readonly userId: string
    ) {
        super(`Cannot remove the owner (${userId}) of workspace ${workspaceId}`);
        this.name = 'CannotRemoveOwnerError';
    }
}
