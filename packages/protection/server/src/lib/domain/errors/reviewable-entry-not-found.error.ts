/**
 * The entry named by the route is not one this workspace can review.
 *
 * **Four causes, one error, deliberately** — the same choice
 * `UnknownProtectedContentTypeError` makes and for the same reason. The content
 * type may not be granted to the workspace, the entry may not exist, it may
 * belong to a different workspace, or it may have no revision at all. Telling
 * them apart would let a member of one workspace probe another's entry ids.
 *
 * The last cause is the interesting one: every save appends a revision, so an
 * entry with none is an entry that was never written by the current writer.
 * There is nothing to bind an approval to, and inventing a head would make the
 * vote unexpirable — the exact failure the revision binding exists to prevent.
 */
export class ReviewableEntryNotFoundError extends Error {
    constructor(
        readonly contentType: string,
        readonly entryId: string
    ) {
        super(`Unknown entry "${contentType}/${entryId}" for this workspace.`);
        this.name = 'ReviewableEntryNotFoundError';
    }
}
