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
    /** Row-per-locale via `locale` + `localeGroupId` envelope columns. */
    i18n?: boolean;
    /** Where the open workspace reaches this type from; absent on older servers. */
    access?: ContentTypeAccessResponse;
};

/** Wire shape of a type's `access`, as the content-schema routes send it. */
export type ContentTypeAccessResponse = {
    own?: boolean;
    sharedSources?: { workspaceId: string; workspaceName: string }[];
};

/**
 * Where the **open workspace** reaches a content type from: its own records
 * (`own` — it holds an own grant and may create), and/or the published records
 * of each shared workspace it was granted the type from. A type can be reached
 * both ways, one way, or — for a type the workspace was not granted — neither.
 */
export type ContentTypeAccess = {
    /** The workspace holds an own grant: its own records, creatable here. */
    own: boolean;
    /** The shared workspaces whose records of this type it may read. */
    sharedSources: EntrySource[];
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
    /** Row-per-locale via `locale` + `localeGroupId` envelope columns. */
    i18n?: boolean;
    /**
     * Where the open workspace reaches this type from. Normalized by the
     * gateway (`toContentType`), so an older server reads as "own, nothing
     * shared"; optional only so a type built outside the gateway (a fixture, a
     * slot contributor's stub) still types — read it through
     * `domain/contentTypeAccess`, never directly.
     */
    access?: ContentTypeAccess;
};

/**
 * How a relation propagates across a record's translations. Mirrors the
 * server's `RelationLocaleSync` without importing across the boundary.
 */
export type RelationLocaleSync = 'shared' | 'mirrored' | 'none';

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
    /** Value differs per locale — present only when true (i18n types). */
    localized?: boolean;
    /**
     * BCP-47 tag naming the language this field's content is written in, when
     * it is not the entry's own (WCAG 3.1.2) — present only when the field
     * declares one. The control carries it as a `lang` attribute, so the value
     * is announced with the right phonemes.
     */
    lang?: string;
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
         * How this link behaves across the record's locales — present only on a
         * localized type:
         *
         * - `shared` — one target for the whole record; editing it in any
         *   locale edits it in all of them.
         * - `mirrored` — each locale links the target's own translation, and
         *   the server resolves which row that is.
         * - `none` — each locale keeps its own links.
         *
         * The editor renders this so a save's reach is visible **before** it
         * happens, rather than discovered afterwards in another language.
         */
        localeSync?: RelationLocaleSync;
        /**
         * Present when this field is the **inverse** side of a two-way relation:
         * `field` is the storage-owning relation on `to`. The picker treats it
         * like any relation (pick records of `to`); the link is shared with the
         * owning side.
         */
        inverse?: { field: string };
    };
    /** Holds an ordered list of assets — present only for `media`. */
    multiple?: boolean;
    /**
     * Accepted-asset restriction (kinds / MIME patterns) — present only for
     * `media` fields that set one. The picker filters candidates by it.
     */
    accept?: {
        kinds?: readonly string[];
        mimeTypes?: readonly string[];
    };
};

/**
 * One attached asset on a media field, resolved for display — the wire shape of
 * `GET /api/content/:type/:id/media` (and a revision detail's `mediaRefs`).
 * Mirrors the server's `MediaRef`. A `missing` ref is an id whose asset was
 * deleted or lives in another workspace; the UI shows "Unavailable asset".
 */
export type MediaRef = {
    id: string;
    name: string;
    /** Raw-stream route for the **original** bytes (empty when `missing`). */
    url: string;
    /**
     * The small (~320px) derivative, when the media plugin generated one — what
     * a tile should render, so a record's media costs a thumbnail rather than a
     * full-size original. Absent for a non-image, an SVG, or a tiny image.
     */
    thumbUrl?: string;
    /** The larger (~1280px) derivative, same caveats as {@link MediaRef.thumbUrl}. */
    previewUrl?: string;
    kind: string;
    mimeType: string;
    alt?: string | null;
    missing?: boolean;
};

/**
 * Wire shape of a content type with its full field schema, as served by
 * `GET /api/content-schema/:name`. Mirrors the server's `SerializedContentType`.
 */
export type ContentTypeDetail = ContentType & {
    /**
     * Collapsible sections of the entry form, in display order — present only
     * when the type declares any. A field joins one through `admin.group`.
     */
    groups?: ContentFieldGroup[];
    /** The type's fields, in declaration order. */
    fields: ContentField[];
};

/** One section of the entry form. Mirrors the server's `SerializedFieldGroup`. */
export type ContentFieldGroup = {
    key: string;
    label: string;
    description?: string;
    /** Starts folded until the reader opens it. */
    collapsed: boolean;
};

/**
 * One collection entry as the admin renders it: the storage envelope
 * (`id`, `createdAt`, `updatedAt`, and `status` for publishable types) plus a
 * value per schema field, keyed by field name. Served by `GET /api/content/:name`.
 */
/** A revision's lifecycle state — mirror of the server's `REVISION_STATUS`. */
export type RevisionStatus = 'draft' | 'published' | 'superseded';

/**
 * One entry revision as served to the timeline (`GET …/:id/revisions`), without
 * the snapshot body. Mirrors the server's `RevisionSummary`.
 */
export type RevisionSummary = {
    /** Revision id. */
    id: string;
    /** Monotonic version number within the entry (1-based). */
    number: number;
    /** Lifecycle state. */
    status: RevisionStatus;
    /** Whether this is the entry's current live version. */
    isPublished: boolean;
    /** Whether this is the newest revision (the only one publishable). */
    isLatest: boolean;
    /** ISO capture timestamp. */
    createdAt: string;
    /** ISO publish timestamp, when published. */
    publishedAt?: string;
    /** The acting user's id, when known. */
    authorId?: string;
};

/** The immutable document a revision captured — `{ values, relations }`. */
export type RevisionSnapshot = {
    /** Field values (scalars, localized + shared, single-relation FK ids). */
    values: Record<string, unknown>;
    /** Ordered target-id list per join-backed relation field. */
    relations: Record<string, string[]>;
    /**
     * State a **plugin** captured alongside the entry, keyed by its extension key
     * (`access` — who could read the entry at the time). Opaque: content stores,
     * compares and hands it to `REVISION_EXTRA_SLOT` to render, and never reads
     * inside it. Mirrors the server's `RevisionSnapshot.extra`.
     *
     * Absent on every version captured before the plugin was installed, which
     * reads as "this version knows nothing about it" — never as "it had none".
     */
    extra?: Record<string, unknown>;
};

/** One revision with its full snapshot body (`GET …/:id/revisions/:number`). */
export type RevisionDetail = RevisionSummary & {
    /** The captured document. */
    snapshot: RevisionSnapshot;
    /**
     * Each relation field's snapshot ids resolved to display refs (title / slug /
     * status), keyed by field name — so the preview lists the actual linked
     * records, not raw uuids. Capped per field; `relationTotals` carries the true
     * count for a "+N more". Mirrors the server's `RevisionDetail.relationRefs`.
     */
    relationRefs?: Record<string, RelationRef[]>;
    /** True link count per relation field (may exceed the capped `relationRefs`). */
    relationTotals?: Record<string, number>;
    /**
     * Each media field's snapshot asset ids resolved to display refs (name /
     * thumbnail url / kind), keyed by field name — so the preview shows the
     * assets a version held, not raw uuids. A single field resolves the id in
     * `snapshot.values`; a `multiple` field its ordered list (with a `missing`
     * placeholder for an id that no longer resolves, so positions hold). Mirrors
     * the server's `RevisionDetail.mediaRefs`.
     */
    mediaRefs?: Record<string, MediaRef[]>;
};

/** The paginated revision-timeline envelope. */
export type RevisionListView = {
    items: RevisionSummary[];
    total: number;
};

/**
 * Where a record that is not the open workspace's own lives — the **shared**
 * workspace it was published from. Mirrors the server's `EntrySourceView`.
 * `null` on every wire field that carries it means "this workspace's own".
 */
export type EntrySource = {
    /** The source workspace's id — where the record can be edited. */
    workspaceId: string;
    /** The source workspace's display name. */
    workspaceName: string;
};

/**
 * Which workspaces a list read covers — `own` (the default, and the only
 * scope before shared workspaces existed), `shared` (published records of
 * shared workspaces granted the same type), or `all` (both). Sent as
 * `?source=` on `GET /content/:type`.
 */
export type EntrySourceScope = 'own' | 'shared' | 'all';

/**
 * Inbound links to one record from **other** workspaces, one row per linking
 * workspace — served by `GET /content/:type/:id/usages`.
 */
export type EntryUsage = {
    /** The linking workspace's id. */
    workspaceId: string;
    /** The linking workspace's display name. */
    workspaceName: string;
    /** How many links that workspace holds to this record. */
    count: number;
};

export type EntryRecord = {
    /** Entry id (the `:entryId` route segment). */
    id: string;
    /** Publication status — present only on `publishable` types. */
    status?: EntryStatus;
    /**
     * ISO timestamp of when this record last went live, or `null` if it never
     * has (or was unpublished) — present only on `publishable` types. Survives
     * an edit, so `status: 'draft'` **with** a `publishedAt` is the *modified*
     * state (live content plus unpublished changes) — see `entryStatusView`.
     */
    publishedAt?: string | null;
    /** Locale slug of this row — present only on `i18n` types. */
    locale?: string;
    /** Shared translation-group id — present only on `i18n` types. */
    localeGroupId?: string;
    /** ISO creation timestamp. */
    createdAt: string;
    /** ISO last-updated timestamp. */
    updatedAt: string;
    /** Field values, keyed by field name. */
    values: Record<string, unknown>;
    /**
     * A capped **preview** of this row's relation links, keyed by relation field
     * name — served only when the list opts in (`relations: 'preview'` plus the
     * visible `relationFields`), which the records table does and the relation
     * picker deliberately does not.
     *
     * Each field carries one page of refs plus its true `total`, so the cell can
     * render a titled summary immediately; the dropdown pages through anything
     * beyond that page via `useRelationFieldLinks`. Additive to {@link values},
     * which still carries an owning single relation's raw FK.
     */
    relations?: Record<string, RelationFieldView>;
    /**
     * The shared workspace this record belongs to, or `null` for the open
     * workspace's own. Normalized by the gateway (`toEntryRecord`), so an
     * older server that sends nothing reads as "own"; optional only so a
     * record built outside the gateway (a cache seed, a test) still types.
     */
    source?: EntrySource | null;
    /**
     * The server's verdict that this record cannot be written from the open
     * workspace — true for a record read from a shared workspace. Normalized
     * to `false` when absent.
     */
    readOnly?: boolean;
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
    /**
     * URL-ish handle — the target's slug-field value when it has one. The editor
     * renders it as a muted `/handle`, falling back to a slugified title when
     * absent (so a handle always shows). Mirrors the server's `RelationRef.slug`.
     */
    slug?: string;
    /** Publish status — present only for publishable target types. */
    status?: EntryStatus;
    /**
     * The link exists but its target could not be resolved — soft-deleted, or
     * outside the open workspace. The server then sends an id-only ref (`title`
     * stands in as the raw id), so the UI must render it as unavailable rather
     * than printing that id. Mirrors the server's `RelationRef.missing`.
     */
    missing?: true;
    /**
     * The shared workspace the linked record lives in, or `null` when it is
     * the open workspace's own. Normalized by the gateway.
     */
    source?: EntrySource | null;
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
 * One entry's media fields resolved to display refs, keyed by field name —
 * served by `GET /api/content/:name/:id/media`; mirrors the server's
 * `EntryMediaView`. Empty when no media resolver is bound.
 */
export type EntryMedia = {
    media: Record<string, MediaRef[]>;
};

/**
 * Coercion type of a filterable path. The string values mirror the
 * query-builder's `FIELD_TYPE` one-for-one (the mapper casts across), so a
 * wire type always names a value editor the picker can render.
 */
export type FilterFieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'uuid'
    | 'date'
    | 'enum';

/**
 * One filterable path served by `GET /content-schema/:name/filter-fields` —
 * a scalar field on the type or, recursively, on one of its relations
 * (`author.name`). `group` is the breadcrumb of relation labels leading to
 * the leaf; `relationTarget` is set on a relation's own `id` path so the
 * picker offers a record chooser instead of a raw uuid input.
 */
export type WireFilterField = {
    path: string;
    label: string;
    type: FilterFieldType;
    enumValues?: readonly string[];
    group: readonly string[];
    relationTarget?: string;
};

/** Response body of `GET /content-schema/:name/filter-fields`. */
export type FilterFieldsResponse = {
    fields: WireFilterField[];
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
export type BulkVerdictKind = (typeof BULK_VERDICT)[keyof typeof BULK_VERDICT];

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

/**
 * One record as the publish context describes it — mirrors the server's
 * `PublishContextRecord`. A linked draft may be of another type than the entry
 * that links to it, hence `type`.
 */
export type PublishContextRecord = {
    id: string;
    type: string;
    /** Display title; absent when the row has none. */
    title?: string;
    status: EntryStatus;
    publishedAt: string | null;
    /** Localized types only. */
    locale?: string;
    /** Localized types only. */
    localeGroupId?: string;
};

/** An unpublished record a requested entry links to, and through which field. */
export type PublishContextLink = PublishContextRecord & {
    field: string;
    fieldLabel: string;
};

/** One requested entry and the unpublished records it links to (one hop). */
export type PublishContextEntry = PublishContextRecord & {
    linked: PublishContextLink[];
    /** Whether `linked` was cut at the server's cap. */
    linkedTruncated: boolean;
};

/** `POST /content/:name/bulk/publish/context` — `null` for an id naming nothing. */
export type PublishContext = {
    entries: Record<string, PublishContextEntry | null>;
};
