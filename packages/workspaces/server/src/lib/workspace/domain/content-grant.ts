/** Whether a granted content item is a multi-entry collection or a single page. */
export type ContentGrantKind = 'collection' | 'single';

/**
 * A content-access grant inside the {@link Workspace} aggregate — the link
 * between the workspace and one code-defined content type it may access. The
 * collections/pages themselves live in code, not the DB; a grant only records
 * that the workspace was linked to a `(kind, slug)`. Identified within the
 * aggregate by `slug` (unique across the catalogue).
 */
export class ContentGrant {
    private constructor(
        private readonly grantKind: ContentGrantKind,
        private readonly grantSlug: string
    ) {}

    /** Builds a grant of `(kind, slug)`. */
    static create(kind: ContentGrantKind, slug: string): ContentGrant {
        return new ContentGrant(kind, slug);
    }

    /** Whether `slug` names a collection or a single page. */
    get kind(): ContentGrantKind {
        return this.grantKind;
    }

    /** The granted content type's slug. */
    get slug(): string {
        return this.grantSlug;
    }
}
