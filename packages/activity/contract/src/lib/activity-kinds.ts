/**
 * The complete audit-event catalogue, keyed symbolically so call sites
 * reference `ACTIVITY_KINDS.USER_ROLE_CHANGED` instead of repeating the string
 * literal. This is the single source of truth shared by the emit-side
 * (`@ortha-cms/activity-server`) and the admin renderer
 * (`@ortha-cms/activity-admin`): the `kind` text column, the typed `meta` map
 * below, and the admin's "Action"/"Details" renderers all read from here.
 */
export const ACTIVITY_KINDS = {
    USER_INVITED: 'user.invited',
    USER_INVITE_RESENT: 'user.invite_resent',
    USER_INVITE_REVOKED: 'user.invite_revoked',
    USER_PROFILE_UPDATED: 'user.profile_updated',
    USER_ROLE_CHANGED: 'user.role_changed',
    USER_SUSPENDED: 'user.suspended',
    USER_REACTIVATED: 'user.reactivated',
    USER_SIGNED_IN: 'user.signed_in',
    USER_SIGNED_OUT: 'user.signed_out',
    WORKSPACE_CREATED: 'workspace.created',
    WORKSPACE_MEMBER_ADDED: 'workspace.member_added',
    WORKSPACE_MEMBER_REMOVED: 'workspace.member_removed'
} as const;

/** A `domain.action` audit kind drawn from {@link ACTIVITY_KINDS}. */
export type ActivityKind = (typeof ACTIVITY_KINDS)[keyof typeof ACTIVITY_KINDS];

/** Every audit kind as a flat list — handy for validation and seeding. */
export const ACTIVITY_KIND_VALUES = Object.values(
    ACTIVITY_KINDS
) as ActivityKind[];

/**
 * The shape of the `meta` jsonb column, discriminated by {@link ActivityKind}.
 * Each kind names exactly the extra fields the admin renders in "Details"
 * (e.g. `user.role_changed` carries the before/after role keys). Kinds with no
 * extra payload map to an empty object.
 */
export interface ActivityMetaMap {
    'user.invited': { email: string };
    'user.invite_resent': { email: string };
    'user.invite_revoked': { email: string };
    'user.profile_updated': { name: { from: string | null; to: string | null } };
    'user.role_changed': { from: string; to: string };
    'user.suspended': Record<string, never>;
    'user.reactivated': Record<string, never>;
    'user.signed_in': Record<string, never>;
    'user.signed_out': Record<string, never>;
    'workspace.created': { name: string };
    'workspace.member_added': { userId: string; email: string | null };
    'workspace.member_removed': { userId: string; email: string | null };
}

/** The `meta` payload for a given kind (`{}` when the kind carries none). */
export type ActivityMeta<K extends ActivityKind = ActivityKind> =
    ActivityMetaMap[K];
