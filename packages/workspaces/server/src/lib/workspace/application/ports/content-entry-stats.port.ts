/**
 * One row of {@link ContentEntryStats.entryStats}: how many entries of one
 * content type a workspace holds, and when the newest of them last changed.
 */
export interface WorkspaceEntryStat {
    /** The workspace the entries belong to. */
    workspaceId: string;
    /** The content type's slug. */
    slug: string;
    /** Every stored row of the type in the workspace (soft-deleted included). */
    count: number;
    /** The latest `updated_at` among those rows; `null` when there are none. */
    lastEditedAt: Date | null;
}

/**
 * The read-side port over the host's stored content entries, **batched**: per
 * workspace and content type, how many entries there are and when they last
 * moved. Backs the workspace cards ("842 records · edited 12 min ago") and the
 * create wizard's "records elsewhere" hint, which read many workspaces at once
 * — so, unlike {@link ContentEntryCounter}, it answers a set of ids in one call
 * rather than one count per round-trip.
 *
 * `@orthacms/content-server` implements it over its generated `content_<name>`
 * tables and binds it to {@link CONTENT_ENTRY_STATS}; this context injects the
 * token, never the content package (the same acyclic inversion as
 * `CONTENT_CATALOG` and `CONTENT_ENTRY_COUNTER`).
 *
 * **Display only.** Nothing destructive may read it: an unbound port answers
 * "no entries", which is not proof of emptiness (see
 * `ContentEntryCounterReader.isBound`).
 */
export interface ContentEntryStats {
    /**
     * Every `(workspace, type)` pair among `workspaceIds` that holds at least
     * one entry. Pairs with no entries may be omitted; an empty id list
     * answers `[]`.
     */
    entryStats(workspaceIds: readonly string[]): Promise<WorkspaceEntryStat[]>;
}

/** DI token the content plugin binds to the concrete {@link ContentEntryStats}. */
export const CONTENT_ENTRY_STATS = Symbol('CONTENT_ENTRY_STATS');
