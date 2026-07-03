/**
 * Raised when a grant references a content-type slug the catalogue doesn't know.
 * Guards against linking a workspace to a type that doesn't exist in code (a
 * typo or a stale client), which would create an unreachable grant row.
 */
export class UnknownContentTypeError extends Error {
    constructor(public readonly slug: string) {
        super(`Unknown content type: ${slug}`);
        this.name = 'UnknownContentTypeError';
    }
}
