import type { EntryStatus } from '../../types/content-type';

/** Re-exported so list-view consumers get publish state from one source. */
export type { EntryStatus };

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

/**
 * One linked record on a relation field, resolved for display: the target id
 * plus a pre-derived {@link EntryRecord} title (and publish `status` for a
 * publishable target). Lets the admin render an assigned relation by title —
 * and seed the form value with the id — without a per-id round-trip.
 */
export interface RelationRef {
    /** The linked entry's id (what a save submits back). */
    id: string;
    /** Display title (first text/select field, else the id). */
    title: string;
    /** Publish status — present only for publishable target types. */
    status?: EntryStatus;
}

/**
 * The relation links of one entry, keyed by relation field name — every
 * relation field (owning single/many **and** inverse back-references), so the
 * editor has a single source for what's linked. A single relation carries at
 * most one ref; a many/inverse relation carries the ordered set.
 */
export interface EntryRelationsView {
    relations: Record<string, RelationRef[]>;
}
