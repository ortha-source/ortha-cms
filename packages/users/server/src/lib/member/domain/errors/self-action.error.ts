import { MEMBER_ERROR_CODES, type MemberErrorCode } from './error-codes';

/**
 * Thrown when a member targets themselves with an action they may not apply
 * to their own account (e.g. disabling themselves, or changing their own
 * role). Transport-agnostic — controllers map it to HTTP 409.
 */
export class SelfActionError extends Error {
    /** Stable wire code — see {@link MEMBER_ERROR_CODES}. */
    readonly code: MemberErrorCode;

    constructor(public readonly userId: string) {
        super(`This action cannot target your own account: ${userId}`);
        this.name = 'SelfActionError';
        this.code = MEMBER_ERROR_CODES.SELF_ACTION;
    }
}
