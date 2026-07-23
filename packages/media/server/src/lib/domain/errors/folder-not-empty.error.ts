/**
 * Raised when a folder delete is attempted while it still holds child folders or
 * assets. The library refuses to cascade-destroy bytes on a single click; the
 * caller must move or delete the contents first.
 */
export class FolderNotEmptyError extends Error {
    constructor(id: string) {
        super(`Folder is not empty: ${id}`);
        this.name = 'FolderNotEmptyError';
    }
}
