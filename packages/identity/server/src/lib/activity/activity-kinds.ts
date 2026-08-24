/**
 * The audit-event kinds identity emits — authentication, API-token lifecycle,
 * and workspace lifecycle. Each plugin owns the kinds for the endpoints it
 * exposes; identity owns auth (sign-in/out), the `/api/api-tokens` management
 * routes, and the workspaces feature (create + membership), so those kinds live
 * here, next to the services that record them.
 */
export const IDENTITY_ACTIVITY_KINDS = {
    USER_SIGNED_IN: 'user.signed_in',
    USER_SIGNED_OUT: 'user.signed_out',
    /** An identity provider was linked to an existing account. */
    USER_SSO_LINKED: 'user.sso_linked',
    /**
     * An account was created from a verified profile — no invite, no password.
     * Distinct from `user.signed_in` on purpose: "somebody signed in" and
     * "an account came into existence" are different facts, and only the second
     * one answers "where did this user come from?".
     */
    USER_SSO_PROVISIONED: 'user.sso_provisioned',
    /** A role-mapping handler changed an account's role on sign-in. */
    USER_SSO_ROLE_MAPPED: 'user.sso_role_mapped',
    /**
     * An external-API bearer token was minted. Named for the `tokens:*`
     * permission family that gates the route, not for the `api_token.created`
     * domain event it is mapped from — identity keeps the two catalogues
     * distinct, same as `auth.signed_in` → `user.signed_in`.
     */
    TOKEN_CREATED: 'token.created',
    /** An external-API bearer token was revoked. */
    TOKEN_REVOKED: 'token.revoked',
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
