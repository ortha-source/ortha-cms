/**
 * Raised when a content-type grant can't be revoked because the workspace still
 * holds entries of that type. Revoking would orphan those records (they'd remain
 * in storage but the workspace could no longer reach them), so removal is only
 * allowed once the type is empty.
 */
export class ContentTypeNotEmptyError extends Error {
    constructor(
        public readonly workspaceId: string,
        public readonly slug: string,
        public readonly entryCount: number
    ) {
        super(
            `Content type "${slug}" still has ${entryCount} entr${
                entryCount === 1 ? 'y' : 'ies'
            } in workspace ${workspaceId}`
        );
        this.name = 'ContentTypeNotEmptyError';
    }
}
