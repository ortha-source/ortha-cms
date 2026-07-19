/**
 * Thrown when creating a workspace whose slug is already in use. Transport-
 * agnostic — the controller maps it to HTTP 409.
 */
export class SlugTakenError extends Error {
    constructor(public readonly slug: string) {
        super(`Workspace slug already taken: ${slug}`);
        this.name = 'SlugTakenError';
    }
}
