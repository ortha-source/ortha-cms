/**
 * Raised when a shared content grant names a source that cannot serve it
 * (ADR-0019, "Explicit per-source grants"): the workspace itself, a workspace
 * that is not shared, an archived one, one that does not exist, or one that
 * holds no own grant for the slug. The HTTP layer maps it to **422** with one
 * message for every case, so the answer never distinguishes "does not exist"
 * from "is not shared".
 */
export class InvalidSharedSourceError extends Error {
    constructor(
        public readonly sourceWorkspaceId: string,
        public readonly slug: string
    ) {
        super(
            `Workspace "${sourceWorkspaceId}" is not a shared workspace offering "${slug}".`
        );
        this.name = 'InvalidSharedSourceError';
    }
}
