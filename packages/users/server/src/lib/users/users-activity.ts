/**
 * The audit-event kinds the users plugin emits — member lifecycle. Each plugin
 * owns the kinds for the endpoints it exposes; these live next to the
 * `UsersService` that records them.
 */
export const USER_ACTIVITY_KINDS = {
    USER_INVITED: 'user.invited',
    USER_INVITE_RESENT: 'user.invite_resent',
    USER_INVITE_REVOKED: 'user.invite_revoked',
    USER_PROFILE_UPDATED: 'user.profile_updated',
    USER_ROLE_CHANGED: 'user.role_changed',
    USER_SUSPENDED: 'user.suspended',
    USER_REACTIVATED: 'user.reactivated'
} as const;
