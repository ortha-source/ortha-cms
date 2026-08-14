/**
 * Raised when removing a membership would leave the workspace with no members
 * at all.
 *
 * Access to a workspace is membership-scoped end to end: `GET /api/workspaces`
 * lists only workspaces the caller belongs to, and every `:id` route is behind
 * `WorkspaceMemberGuard`. A workspace with zero members is therefore not merely
 * empty — it is **unreachable by everyone**, including a global admin holding
 * every `workspaces:*` permission, who can no longer read, update, re-join or
 * even delete it. The row survives with no route back to it, so the only
 * remedy is direct database access.
 *
 * Refusing the removal is deliberately the whole fix: reassigning or deleting
 * the workspace on the caller's behalf would destroy or hand over data as a
 * side effect of a "remove one member" request. The caller can delete the
 * workspace explicitly if that is what they meant.
 */
export class LastMemberError extends Error {
    constructor(
        public readonly workspaceId: string,
        public readonly userId: string
    ) {
        super(
            `Cannot remove the last member of workspace ${workspaceId}: it would leave the workspace unreachable`
        );
        this.name = 'LastMemberError';
    }
}
