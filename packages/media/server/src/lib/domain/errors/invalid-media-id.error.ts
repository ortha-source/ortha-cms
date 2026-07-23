/** Raised when a raw string is not a valid media id (asset or folder). */
export class InvalidMediaIdError extends Error {
    constructor(kind: 'asset' | 'folder', value: string) {
        super(`Invalid ${kind} id: ${value}`);
        this.name = 'InvalidMediaIdError';
    }
}
