/** Whether a granted content item is a multi-entry collection or a single page. */
export type ContentGrantKind = 'collection' | 'single';

/**
 * A content-access grant inside the {@link Workspace} aggregate — the link
 * between the workspace and one code-defined content type. The
 * collections/pages themselves live in code, not the DB; a grant only records
 * that the workspace was linked to a `(kind, slug)`.
 *
 * Two kinds of grant (ADR-0019, "Explicit per-source grants"):
 * - an **own** grant (`sourceWorkspaceId === null`) lets the workspace author
 *   its own records of the type;
 * - a **shared** grant names one shared workspace whose published records of
 *   the type this workspace may read and link, never write.
 *
 * Identified within the aggregate by `(slug, sourceWorkspaceId)`.
 */
export class ContentGrant {
    private constructor(
        private readonly grantKind: ContentGrantKind,
        private readonly grantSlug: string,
        private readonly grantSource: string | null
    ) {}

    /** Builds a grant of `(kind, slug)`, own unless `sourceWorkspaceId` is given. */
    static create(
        kind: ContentGrantKind,
        slug: string,
        sourceWorkspaceId: string | null = null
    ): ContentGrant {
        return new ContentGrant(kind, slug, sourceWorkspaceId);
    }

    /** Whether `slug` names a collection or a single page. */
    get kind(): ContentGrantKind {
        return this.grantKind;
    }

    /** The granted content type's slug. */
    get slug(): string {
        return this.grantSlug;
    }

    /** The shared workspace this grant reads from; `null` for an own grant. */
    get sourceWorkspaceId(): string | null {
        return this.grantSource;
    }

    /** Whether this is an own grant (no source workspace). */
    get isOwn(): boolean {
        return this.grantSource === null;
    }

    /** Whether this grant is the one identified by `(slug, source)`. */
    matches(slug: string, sourceWorkspaceId: string | null): boolean {
        return (
            this.grantSlug === slug && this.grantSource === sourceWorkspaceId
        );
    }
}
