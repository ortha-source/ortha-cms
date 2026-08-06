/**
 * Wire contracts for the public content API (`/api/v1/...`). Kept separate from
 * the admin's `EntryRecord` on purpose: this is a **published contract** an
 * external site or app builds against, so it must be free to stay still while
 * the admin's internal shape evolves.
 */

/**
 * One entry as the public API serves it: the storage envelope plus a flat
 * `values` bag keyed by field name.
 *
 * `values` carries every **column-backed** field — scalars, `json`,
 * `multiselect`, media ids, and the raw uuid of an owning single relation
 * (which a consumer can follow with a second read of the target type). Fields
 * whose links live outside the row — an owning many-relation (a join table)
 * and the inverse side of a two-way relation — are **absent**: this API reads
 * flat records and does not expand or traverse relations.
 *
 * `status` is deliberately not exposed. Publishable types serve **only**
 * published entries here, so it would be a constant; `publishedAt` is the
 * useful half of the pair and is carried instead.
 */
export interface PublicEntry {
    /** Entry id — the `:id` segment of the single-entry route. */
    id: string;
    /** ISO creation timestamp. */
    createdAt: string;
    /** ISO last-updated timestamp. */
    updatedAt: string;
    /**
     * ISO timestamp of when this entry last went live — only on `publishable`
     * types. Never null in a public response: an entry with no published
     * version is not served at all.
     */
    publishedAt?: string | null;
    /** Locale slug of this row — only on `i18n` types. */
    locale?: string;
    /** Shared translation-group id — only on `i18n` types, so a consumer can
     * correlate an entry with its other translations. */
    localeGroupId?: string;
    /** Field values, keyed by field name (see the note above on relations). */
    values: Record<string, unknown>;
}

/** One page of public entries. */
export interface PublicEntryListView {
    items: PublicEntry[];
    /** Total matching entries, ignoring pagination. */
    total: number;
    /** 1-based page number this page represents. */
    page: number;
    /** Rows per page actually applied. */
    pageSize: number;
}
