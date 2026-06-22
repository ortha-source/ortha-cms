/** Publish state a publishable entry row carries. */
export type EntryStatus = 'draft' | 'published';

/**
 * One entry as served to the admin records table: the storage envelope plus a
 * `values` bag keyed by field name. Mirrors the admin's `EntryRecord` — the
 * wire contract the dynamic table renders from. `status` is present only on
 * `publishable` types (see {@link EntryEnvelope}).
 */
export interface EntryRecord {
    /** Entry id (the `:entryId` route segment). */
    id: string;
    /** Publication status — only on `publishable` types. */
    status?: EntryStatus;
    /** ISO creation timestamp. */
    createdAt: string;
    /** ISO last-updated timestamp. */
    updatedAt: string;
    /** Field values, keyed by field name. */
    values: Record<string, unknown>;
}

/** The paginated envelope, matching the admin list-page convention. */
export interface EntryListView {
    items: EntryRecord[];
    total: number;
    page: number;
    pageSize: number;
}
