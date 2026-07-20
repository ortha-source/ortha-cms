/**
 * Thrown when a {@link PasswordHash} is constructed from an empty or malformed
 * value. Guards the aggregate against storing a credential that could never
 * verify. Transport-agnostic.
 */
export class InvalidPasswordHashError extends Error {
    constructor() {
        super('Invalid password hash: value is empty or malformed');
        this.name = 'InvalidPasswordHashError';
    }
}
