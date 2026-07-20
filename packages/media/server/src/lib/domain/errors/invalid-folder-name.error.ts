/** Raised when a folder name is empty or exceeds the length bound. */
export class InvalidFolderNameError extends Error {
    constructor(value: string) {
        super(`Invalid folder name: ${value}`);
        this.name = 'InvalidFolderNameError';
    }
}
