/**
 * Thrown when a {@link UserAccountStatus} is constructed from an unknown
 * lifecycle key. Transport-agnostic — a controller maps it to HTTP 400.
 */
export class InvalidUserStatusError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid user status: ${value}`);
        this.name = 'InvalidUserStatusError';
    }
}
