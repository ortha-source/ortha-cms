/** Raised when adding a member whose user id doesn't resolve to a real user. */
export class MemberNotFoundError extends Error {
    constructor(public readonly userId: string) {
        super(`User not found: ${userId}`);
        this.name = 'MemberNotFoundError';
    }
}
