/**
 * Thrown when an operation targets a user account that does not exist.
 * Transport-agnostic — a controller maps it to HTTP 404.
 */
export class UserAccountNotFoundError extends Error {
    constructor(public readonly userId: string) {
        super(`User account not found: ${userId}`);
        this.name = 'UserAccountNotFoundError';
    }
}
