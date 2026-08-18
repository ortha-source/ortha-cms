/**
 * The **audit** kinds the users plugin records in-band via the activity
 * recorder — member lifecycle. Distinct from the `member.*` domain-event kinds
 * ({@link MEMBER_EVENT_KINDS}); each plugin owns the kinds for the endpoints it
 * exposes. Wave 3 will move auditing onto an outbox subscriber that maps the
 * domain events to these kinds.
 */
export const USER_ACTIVITY_KINDS = {
    USER_INVITED: 'user.invited',
    USER_INVITE_RESENT: 'user.invite_resent',
    USER_INVITE_REVOKED: 'user.invite_revoked',
    USER_PASSWORD_RESET_ISSUED: 'user.password_reset_issued',
    USER_PROFILE_UPDATED: 'user.profile_updated',
    USER_ROLE_CHANGED: 'user.role_changed',
    USER_SUSPENDED: 'user.suspended',
    USER_REACTIVATED: 'user.reactivated'
} as const;
