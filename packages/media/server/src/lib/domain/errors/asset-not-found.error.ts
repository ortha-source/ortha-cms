/** Raised when an asset id does not resolve within the current workspace. */
export class AssetNotFoundError extends Error {
    constructor(id: string) {
        super(`Asset not found: ${id}`);
        this.name = 'AssetNotFoundError';
    }
}
