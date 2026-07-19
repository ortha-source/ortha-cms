/**
 * Port that revokes a member's live sessions — the immediate-lockout side
 * effect of disabling an account, so access ends at once rather than at next
 * session expiry. Implemented in infrastructure over identity's `sessions`
 * table and bound to {@link SESSION_REVOKER}; runs inside the active unit of
 * work so the revocation commits with the disable.
 */
export interface SessionRevoker {
    /** Revokes every live session for `userId`. */
    revoke(userId: string): Promise<void>;
}

/** DI token the infrastructure adapter binds to a {@link SessionRevoker}. */
export const SESSION_REVOKER = Symbol('SESSION_REVOKER');
