/** Raised when a file name is empty, too long, or contains a path separator. */
export class InvalidFileNameError extends Error {
    constructor(value: string) {
        super(`Invalid file name: ${value}`);
        this.name = 'InvalidFileNameError';
    }
}
