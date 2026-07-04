/**
 * Content-type contracts as the admin sees them. Mirrors the server's
 * `SerializedContentTypeSummary` (the wire shape of `GET /api/content-schema`)
 * without importing across the server boundary. The full field schema
 * (`GET /api/content-schema/:name`) lands with the entry editor milestone.
 */

import { BULK_VERDICT, CONTENT_TYPE_KIND, ENTRY_STATUS } from '../../constants';

/** Multi-entry collection vs. standalone page — matches the server's `kind`. */
export type ContentTypeKind =
    (typeof CONTENT_TYPE_KIND)[keyof typeof CONTENT_TYPE_KIND];

/** Publish state of an entry on a publishable type. */
export type EntryStatus = (typeof ENTRY_STATUS)[keyof typeof ENTRY_STATUS];

/** Wire shape of one content-type summary, as served by `GET /api/content-schema`. */
export type ContentTypeSummaryResponse = {
    name: string;
    kind: ContentTypeKind;
    label: string;
    description?: string;
    path?: string;
    /** Tracks publish time via a `publishedAt` envelope column. */
    publishable?: boolean;
    /** Soft-deletes via a `deletedAt` envelope column. */
    paranoid?: boolean;
};

/**
 * A content type as rendered by the Content Library: its stable machine
 * `name` (also the route segment), display `label`, `kind` (drives the
 * Collections vs Pages grouping), and the optional `description`/`path`.
 */
export type ContentType = {
    /** Stable machine name / slug — the `:typeName` route segment. */
    name: string;
    /** `collection` → Collections group; `single` → Pages group. */
    kind: ContentTypeKind;
    /** Human label shown in the sidebar, palette, and type header. */
    label: string;
    /** Short description shown in the type header, if any. */
    description?: string;
    /** Route path — singles (pages) only. */
    path?: string;
    /** Tracks publish time via a `publishedAt` envelope column. */
    publishable?: boolean;
    /** Soft-deletes via a `deletedAt` envelope column. */
    paranoid?: boolean;
};

/**
 * Wire shape of one field, as served by `GET /api/content-schema/:name`.
 * Mirrors the server's `SerializedField`
 * (`packages/content/server/src/lib/registry/content-type-registry.ts`)
 * without importing across the server boundary.
 */
export type ContentField = {
    /** Machine name of the field — the key on an entry record. */
    name: string;
    /** Field kind: `text`/`richtext`/`number`/`money`/`boolean`/`date`/`datetime`/`select`/`multiselect`/`json`/`relation`. */
    type: string;
    /** Whether a value is required. */
    required: boolean;
    /** Type-specific validation (minLength, max, pattern, …); opaque here. */
    validation: Record<string, unknown>;
    /** Admin display hints (label, description, placeholder, widget, hidden, …). */
    admin: Record<string, unknown>;
    /** Allowed values — present only for `select`. */
    options?: readonly string[];
    /** Relation target — present only for `relation`. */
    relation?: {
        to: string;
        many: boolean;
        onDelete?: string;
        unique?: boolean;
        /**
         * Present when this field is the **inverse** side of a two-way relation:
         * `field` is the storage-owning relation on `to`. The picker treats it
         * like any relation (pick records of `to`); the link is shared with the
         * owning side.
         */
        inverse?: { field: string };
    };
};

/**
 * Wire shape of a content type with its full field schema, as served by
 * `GET /api/content-schema/:name`. Mirrors the server's `SerializedContentType`.
 */
export type ContentTypeDetail = ContentType & {
    /** The type's fields, in declaration order. */
    fields: ContentField[];
};

/**
 * One collection entry as the admin renders it: the storage envelope
 * (`id`, `createdAt`, `updatedAt`, and `status` for publishable types) plus a
 * value per schema field, keyed by field name. Served by `GET /api/content/:name`.
 */
export type EntryRecord = {
    /** Entry id (the `:entryId` route segment). */
    id: string;
    /** Publication status — present only on `publishable` types. */
    status?: EntryStatus;
    /** ISO creation timestamp. */
    createdAt: string;
    /** ISO last-updated timestamp. */
    updatedAt: string;
    /** Field values, keyed by field name. */
    values: Record<string, unknown>;
};

/**
 * One linked record on a relation field, resolved for display — served by
 * `GET /api/content/:name/:id/relations`. Mirrors the server's `RelationRef`.
 * Carries the target `id` (what a save submits back) and a pre-derived `title`,
 * so the editor renders an assigned relation without a per-id round-trip.
 */
export type RelationRef = {
    /** The linked entry's id. */
    id: string;
    /** Display title (first text/select field, else the id). */
    title: string;
    /** Publish status — present only for publishable target types. */
    status?: EntryStatus;
};

/**
 * One relation field's links: a **windowed** page of refs plus the `total` count
 * across the whole set. A many/inverse relation can hold far more links than fit
 * in one payload, so the editor pages through them (infinite scroll); a single
 * relation is a `total` of 0/1. Mirrors the server's `RelationFieldView`.
 */
export type RelationFieldView = {
    items: RelationRef[];
    /** Total links on this field, across all pages. */
    total: number;
};

/**
 * One entry's relation links keyed by field name — every relation field (owning
 * single/many **and** inverse back-references), each a first page + total.
 * Served by `GET /api/content/:name/:id/relations`; mirrors the server's
 * `EntryRelationsView`.
 */
export type EntryRelations = {
    relations: Record<string, RelationFieldView>;
};

/**
 * An incremental change to one many/inverse relation field, sent with the entry
 * save (`{ relations: { <field>: RelationDelta } }`). Only the diff is sent, so a
 * relation with thousands of links is never transmitted (or held) in full.
 * `order` renumbers the listed ids (owning many-relations only).
 */
export type RelationDelta = {
    link?: string[];
    unlink?: string[];
    order?: string[];
};

/**
 * The editor's **local** staging for one many/inverse relation field — the
 * pending link/unlink/reorder the user has made but not yet saved. `added`
 * carries full refs (with titles) so newly-linked rows render immediately;
 * `removed` are ids unlinked from the server set; `order` is the desired display
 * order (owning relations only), or `null` when untouched. Serialized to a
 * {@link RelationDelta} and sent on Save.
 */
export type StagedRelation = {
    added: RelationRef[];
    removed: string[];
    order: string[] | null;
};

/**
 * One failed validation rule on one field, as returned in a 422 body's `issues`
 * array. Mirrors the server's `ValidationIssue`.
 */
export type EntryValidationIssue = {
    /** The field the rule failed on. */
    field: string;
    /** Human-readable failure (e.g. "is required"). */
    message: string;
};

/** Per-entry verdict kind in a bulk-publish dry run — mirror of the server. */
export type BulkVerdictKind =
    (typeof BULK_VERDICT)[keyof typeof BULK_VERDICT];

/**
 * One field's publish-gate check on a record — pass/fail (and the message when
 * failing). Mirrors the server's `BulkPublishCheck`.
 */
export type BulkPublishCheck = {
    /** Field name. */
    field: string;
    /** Human label (admin label, else the field name). */
    label: string;
    /** Whether the field passes publish validation. */
    ok: boolean;
    /** The failure message when `ok` is false. */
    message?: string;
};

/**
 * One entry's dry-run verdict, as served by `POST /content/:type/bulk/publish/preview`.
 * Mirrors the server's `BulkPublishVerdict`.
 */
export type BulkPublishVerdict = {
    id: string;
    /** Display label (first text field, else id). */
    title: string;
    /** Current publish state, or null when not found. */
    status: EntryStatus | null;
    verdict: BulkVerdictKind;
    /** Populated only when `verdict === 'blocked'`. */
    issues: EntryValidationIssue[];
    /**
     * Per-field publish-gate checks (required + invalid fields), pass/fail; empty
     * for already-published / not-found rows.
     */
    checks: BulkPublishCheck[];
};

/** The dry-run response: one verdict per requested id, in request order. */
export type BulkPublishPreview = {
    items: BulkPublishVerdict[];
};

/** The result of committing a bulk publish. */
export type BulkPublishResult = {
    /** Ids actually transitioned to published. */
    published: string[];
    /** Ids left untouched, with the verdict kind that skipped them. */
    skipped: { id: string; reason: BulkVerdictKind }[];
};

/** The result of a bulk unpublish/delete/restore — how many rows changed. */
export type BulkActionResult = {
    count: number;
};
