/**
 * Thrown when an operation targets a member id that does not exist.
 * Transport-agnostic — controllers map it to HTTP 404.
 */
export class MemberNotFoundError extends Error {
    constructor(public readonly userId: string) {
        super(`No user with id: ${userId}`);
        this.name = 'MemberNotFoundError';
    }
}
