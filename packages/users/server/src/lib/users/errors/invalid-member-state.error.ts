/**
 * Thrown when an operation does not apply to the member's current lifecycle
 * state — e.g. resending an invite to an already-active user, or disabling a
 * pending one. Transport-agnostic — controllers map it to HTTP 409.
 */
export class InvalidMemberStateError extends Error {
    constructor(
        public readonly userId: string,
        public readonly status: string,
        operation: string
    ) {
        super(`Cannot ${operation} a ${status} user: ${userId}`);
        this.name = 'InvalidMemberStateError';
    }
}
