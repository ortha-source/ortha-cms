/**
 * Thrown when an {@link Email} is constructed from a value that is not a valid
 * email address. Transport-agnostic — a controller maps it to HTTP 400.
 */
export class InvalidEmailError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid email: ${value}`);
        this.name = 'InvalidEmailError';
    }
}
