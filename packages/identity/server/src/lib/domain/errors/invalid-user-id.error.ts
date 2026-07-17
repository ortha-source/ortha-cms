/**
 * Thrown when a {@link UserId} is constructed from a value that is not a UUID.
 * Transport-agnostic — a controller maps it to HTTP 400.
 */
export class InvalidUserIdError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid user id: ${value}`);
        this.name = 'InvalidUserIdError';
    }
}
