/**
 * The audit-event kinds identity emits — authentication and workspace
 * lifecycle. Each plugin owns the kinds for the endpoints it exposes; identity
 * owns auth (sign-in/out) and the workspaces feature (create + membership), so
 * those kinds live here, next to the services that record them.
 */
export const IDENTITY_ACTIVITY_KINDS = {
    USER_SIGNED_IN: 'user.signed_in',
    USER_SIGNED_OUT: 'user.signed_out',
    WORKSPACE_CREATED: 'workspace.created',
    WORKSPACE_UPDATED: 'workspace.updated',
    WORKSPACE_ARCHIVED: 'workspace.archived',
    WORKSPACE_UNARCHIVED: 'workspace.unarchived',
    WORKSPACE_DELETED: 'workspace.deleted',
    WORKSPACE_MEMBER_ADDED: 'workspace.member_added',
    WORKSPACE_MEMBER_REMOVED: 'workspace.member_removed',
    WORKSPACE_CONTENT_GRANTED: 'workspace.content_granted',
    WORKSPACE_CONTENT_REVOKED: 'workspace.content_revoked'
} as const;

/** An audit kind emitted by identity. */
export type IdentityActivityKind =
    (typeof IDENTITY_ACTIVITY_KINDS)[keyof typeof IDENTITY_ACTIVITY_KINDS];
