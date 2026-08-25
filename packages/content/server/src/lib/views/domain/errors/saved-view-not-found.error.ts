/**
 * A saved view the caller may not read, or that does not exist. One error for
 * both so the API cannot be used to probe which views other people hold — the
 * controller maps it to a 404 either way.
 */
export class SavedViewNotFoundError extends Error {
    constructor(id: string) {
        super(`Saved view "${id}" was not found.`);
        this.name = 'SavedViewNotFoundError';
    }
}
