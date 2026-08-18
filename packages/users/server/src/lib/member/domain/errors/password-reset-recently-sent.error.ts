import { MEMBER_ERROR_CODES, type MemberErrorCode } from './error-codes';

/**
 * Thrown when a password-reset link is requested while the previous one is
 * still fresh.
 *
 * Issuing is unconditionally destructive — it deletes the live token and mints
 * a new one — and the raw token is **never recoverable** (only its SHA-256 is
 * stored), so the server cannot "return the existing link instead". The only
 * way to stop a double-click from destroying the link the admin was handed a
 * second ago is to refuse the second call, which leaves the first one valid.
 *
 * Transport-agnostic — controllers map it to HTTP 409 with
 * `PASSWORD_RESET_RECENTLY_SENT` plus the wait, so a client can say "try again
 * in 42s" rather than the generic conflict message.
 */
export class PasswordResetRecentlySentError extends Error {
    /** Stable wire code — see {@link MEMBER_ERROR_CODES}. */
    readonly code: MemberErrorCode;

    constructor(
        public readonly userId: string,
        /** Whole seconds the caller should wait before requesting another. */
        public readonly retryAfterSeconds: number
    ) {
        super(
            `A password reset link was just issued for this member; wait ${retryAfterSeconds}s before issuing another: ${userId}`
        );
        this.name = 'PasswordResetRecentlySentError';
        this.code = MEMBER_ERROR_CODES.PASSWORD_RESET_RECENTLY_SENT;
    }
}
