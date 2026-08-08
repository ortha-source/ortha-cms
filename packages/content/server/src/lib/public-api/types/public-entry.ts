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
 * `values` carries the entry's **own** data only — text, richtext, number,
 * money, boolean, date, datetime, select, multiselect, and json. Every
 * **reference** field is omitted: `relation` in all four cardinalities and
 * `media`. Neither is resolvable through this API yet, so returning a bare
 * uuid would hand a consumer an identifier it has no route to follow.
 *
 * That omission is **provisional**, not the intended end state. The schema
 * endpoint still describes the omitted fields, because they are part of the
 * real content model; when relation and media reads land they begin appearing
 * in `values`, which only ever adds keys.
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
    /** The entry's own field values, keyed by field name (see the note above
     * on which kinds are omitted). */
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
