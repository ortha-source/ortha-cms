/**
 * Thrown by every failing step of the password-reset flow — an unknown token,
 * an expired one, one already consumed, a token whose account has since been
 * deleted, and one whose account is no longer `active` (a suspended account is
 * reactivated, not reset). Like {@link InvalidInviteTokenError}, it carries no
 * distinguishing detail, so the controller's generic 404 cannot be used to
 * probe which reset links are live.
 */
export class InvalidResetTokenError extends Error {
    constructor() {
        super('Invalid or expired password reset token');
        this.name = 'InvalidResetTokenError';
    }
}
