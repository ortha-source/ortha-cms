/**
 * The read-side port over the host's stored content entries: how many entries of
 * a given content type a workspace holds. `@ortha-cms/content-server` implements
 * it over its generated `content_<name>` tables and binds it to
 * {@link CONTENT_ENTRY_COUNTER}; identity (the foundational package) injects the
 * **token**, never the content package — so identity stays free of a dependency
 * on `content-server`, keeping the graph acyclic (same inversion as
 * {@link CONTENT_CATALOG}).
 *
 * Backs the "remove a content-type grant only when it's empty" rule: identity
 * asks the counter before revoking a grant, and blocks the revoke if the type
 * still holds entries in that workspace.
 *
 * Inject it with `@Optional()`: when no content plugin is present (identity
 * booted standalone, e.g. a test), there are no entry tables at all, so a
 * missing counter means zero entries — the caller treats every type as empty.
 */
export interface ContentEntryCounter {
    /**
     * How many entries of content type `slug` exist in `workspaceId`. Counts
     * every stored row for the type in that workspace (including soft-deleted
     * ones for paranoid types — data that still exists must keep the grant). An
     * unknown slug resolves to `0`.
     */
    countEntries(workspaceId: string, slug: string): Promise<number>;

    /**
     * How many entries a workspace holds across **every** content type. Backs
     * the "a workspace can only be deleted once it holds no content" rule, so a
     * delete never orphans records. Sums {@link countEntries} over the whole
     * catalogue; `0` when no content plugin is bound.
     */
    countWorkspaceEntries(workspaceId: string): Promise<number>;
}

/** DI token the content plugin binds to the concrete {@link ContentEntryCounter}. */
export const CONTENT_ENTRY_COUNTER = Symbol('CONTENT_ENTRY_COUNTER');
