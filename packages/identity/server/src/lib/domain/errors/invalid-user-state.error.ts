/**
 * Thrown when a {@link UserAccount} lifecycle transition is attempted from a
 * state that does not permit it (e.g. enabling an account that is not disabled).
 * Transport-agnostic — a controller maps it to HTTP 409/422.
 */
export class InvalidUserStateError extends Error {
    constructor(
        public readonly userId: string,
        public readonly status: string,
        public readonly action: string
    ) {
        super(`Cannot ${action} a ${status} user account (${userId})`);
        this.name = 'InvalidUserStateError';
    }
}
