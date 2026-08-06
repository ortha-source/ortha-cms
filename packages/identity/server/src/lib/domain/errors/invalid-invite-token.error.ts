/**
 * Thrown by every failing step of the invite-accept flow — an unknown token, an
 * expired one, one already consumed, a token whose account has since been
 * revoked, or one whose account is no longer `pending`. Like
 * {@link InvalidCredentialsError}, it carries no distinguishing detail so the
 * controller's generic 404 cannot be used to probe which invites exist.
 */
export class InvalidInviteTokenError extends Error {
    constructor() {
        super('Invalid or expired invite token');
        this.name = 'InvalidInviteTokenError';
    }
}
