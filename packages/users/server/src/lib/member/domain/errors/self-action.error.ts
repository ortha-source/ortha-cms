/**
 * Thrown when a member targets themselves with an action they may not apply
 * to their own account (e.g. disabling themselves, or changing their own
 * role). Transport-agnostic — controllers map it to HTTP 409.
 */
export class SelfActionError extends Error {
    constructor(public readonly userId: string) {
        super(`This action cannot target your own account: ${userId}`);
        this.name = 'SelfActionError';
    }
}
