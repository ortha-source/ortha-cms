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
    /** Locale slug of this row — only on `i18n` types. */
    locale?: string;
    /** Shared translation-group id — only on `i18n` types. */
    localeGroupId?: string;
    /** ISO creation timestamp. */
    createdAt: string;
    /** ISO last-updated timestamp. */
    updatedAt: string;
    /** Field values, keyed by field name. */
    values: Record<string, unknown>;
    /**
     * A capped **preview** of this entry's relation links, keyed by relation
     * field name — present only when the caller opts in with
     * `?relations=preview&relationFields=<names>` (the records table, for its
     * visible relation columns). Each field carries at most one page of refs
     * plus its true `total`, so a record with thousands of links contributes one
     * page here; the table's dropdown pages through the rest via
     * `GET /content/:type/:id/relations/:field`.
     *
     * Additive to {@link values}, never a replacement: an owning single
     * relation still passes through `values` as its raw FK, which is what a save
     * submits back.
     */
    relations?: Record<string, RelationFieldView>;
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
    /**
     * URL-ish handle for the record — the value of its slug field (a field with
     * `admin.widget === 'slug'`, else one literally named `slug`) when non-empty.
     * Absent when the target has no slug field; the admin falls back to a
     * slugified title for display.
     */
    slug?: string;
    /** Publish status — present only for publishable target types. */
    status?: EntryStatus;
}

/**
 * One relation field's links: a **windowed** page of resolved refs plus the
 * `total` count across the whole set. A many/inverse relation can hold far more
 * links than fit in one payload, so the editor pages through them (infinite
 * scroll) rather than loading every id; a single relation is a `total` of 0/1.
 */
export interface RelationFieldView {
    items: RelationRef[];
    /** Total links on this field (across all pages). */
    total: number;
}

/**
 * The relation links of one entry, keyed by relation field name — every relation
 * field (owning single/many **and** inverse back-references), each a **first
 * page** of links + its total, so the editor has one source for what's linked
 * and its counts. Further pages come from the per-field read.
 */
export interface EntryRelationsView {
    relations: Record<string, RelationFieldView>;
}

/**
 * An incremental change to one many/inverse relation field — the wire body of
 * `POST /content/:type/:id/relations/:field`. Only the diff crosses the wire, so
 * a relation with thousands of links never has to be sent (or held) in full.
 * `order` renumbers the listed ids (owning many-relations only); it's ignored
 * for the inverse side, which doesn't own the order.
 */
export interface RelationDelta {
    /** Target ids to link (append; re-linking an existing pair is a no-op). */
    link?: string[];
    /** Target ids to unlink. */
    unlink?: string[];
    /** Desired order of the listed target ids (owning many-relations only). */
    order?: string[];
}
