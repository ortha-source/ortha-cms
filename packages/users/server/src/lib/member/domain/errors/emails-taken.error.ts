import { MEMBER_ERROR_CODES, type MemberErrorCode } from './error-codes';

/**
 * Thrown when a **batch** invite names addresses that already belong to
 * accounts (compared case-insensitively). Carries every colliding address, so
 * one round trip tells the admin all of them rather than one per retry.
 *
 * Shares the `EMAIL_TAKEN` wire code with {@link EmailTakenError}: it is the
 * same fact, about more than one address. Transport-agnostic — the controller
 * maps it to HTTP 409.
 */
export class EmailsTakenError extends Error {
    /** Stable wire code — see {@link MEMBER_ERROR_CODES}. */
    readonly code: MemberErrorCode;

    constructor(public readonly emails: readonly string[]) {
        super(`Already members: ${emails.join(', ')}`);
        this.name = 'EmailsTakenError';
        this.code = MEMBER_ERROR_CODES.EMAIL_TAKEN;
    }
}
