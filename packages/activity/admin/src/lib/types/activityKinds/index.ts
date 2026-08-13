/**
 * The audit-event kinds the Activity Log renders. The admin can't import the
 * server plugins (separate apps / module boundaries), so it restates the kind
 * strings here — exactly as it restates wire types — as the source for the
 * `ActivityKind` type and the action-label map. Each string mirrors a kind an
 * emitting plugin records (identity owns auth/workspace, users owns member
 * lifecycle, content owns the entry publish lifecycle).
 */
export const ACTIVITY_KINDS = [
    'user.invited',
    'user.invite_resent',
    'user.invite_revoked',
    'user.profile_updated',
    'user.role_changed',
    'user.suspended',
    'user.reactivated',
    'user.password_changed',
    'user.signed_in',
    'user.signed_out',
    'workspace.created',
    'workspace.member_added',
    'workspace.member_removed',
    'entry.published',
    'entry.unpublished',
    'token.created',
    'token.revoked'
] as const;

/** A kind the Activity Log knows how to render. */
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
