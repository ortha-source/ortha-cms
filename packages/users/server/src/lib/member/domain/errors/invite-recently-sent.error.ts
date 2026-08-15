import { MEMBER_ERROR_CODES, type MemberErrorCode } from './error-codes';

/**
 * Thrown when a resend arrives while the current invite link is still fresh.
 *
 * Rotation is unconditionally destructive — it deletes the live token and mints
 * a new one — and the raw token is **never recoverable** (only its SHA-256 is
 * stored), so the server cannot "return the existing link instead". The only
 * way to stop a double-click from destroying the link the admin was handed a
 * second ago is to refuse the second call, which leaves the first one valid.
 *
 * Transport-agnostic — controllers map it to HTTP 409 with
 * `INVITE_RECENTLY_SENT`, so a client can say "you just sent one" rather than
 * the generic conflict message.
 */
export class InviteRecentlySentError extends Error {
    /** Stable wire code — see {@link MEMBER_ERROR_CODES}. */
    readonly code: MemberErrorCode;

    constructor(
        public readonly userId: string,
        /** Whole seconds the caller should wait before resending. */
        public readonly retryAfterSeconds: number
    ) {
        super(
            `An invite was just sent to this member; wait ${retryAfterSeconds}s before resending: ${userId}`
        );
        this.name = 'InviteRecentlySentError';
        this.code = MEMBER_ERROR_CODES.INVITE_RECENTLY_SENT;
    }
}
