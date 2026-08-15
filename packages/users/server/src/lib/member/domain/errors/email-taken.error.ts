import { MEMBER_ERROR_CODES, type MemberErrorCode } from './error-codes';

/**
 * Thrown when an invite targets an email that already has an account
 * (compared case-insensitively, matching the DB's unique index).
 * Transport-agnostic — controllers map it to HTTP 409.
 */
export class EmailTakenError extends Error {
    /** Stable wire code — see {@link MEMBER_ERROR_CODES}. */
    readonly code: MemberErrorCode;

    constructor(public readonly email: string) {
        super(`A user with this email already exists: ${email}`);
        this.name = 'EmailTakenError';
        this.code = MEMBER_ERROR_CODES.EMAIL_TAKEN;
    }
}
