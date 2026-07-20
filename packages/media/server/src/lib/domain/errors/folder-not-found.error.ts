/** Raised when a folder id does not resolve within the current workspace. */
export class FolderNotFoundError extends Error {
    constructor(id: string) {
        super(`Folder not found: ${id}`);
        this.name = 'FolderNotFoundError';
    }
}
