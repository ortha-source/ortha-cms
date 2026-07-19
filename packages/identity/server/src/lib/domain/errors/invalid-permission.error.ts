/**
 * Thrown when a {@link Permission} is constructed from a value that is not a
 * `resource:action` permission key. Transport-agnostic.
 */
export class InvalidPermissionError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid permission key: ${value}`);
        this.name = 'InvalidPermissionError';
    }
}
