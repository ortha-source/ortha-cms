/**
 * Content-type contracts as the admin sees them. Mirrors the server's
 * `SerializedContentTypeSummary` (the wire shape of `GET /api/content-schema`)
 * without importing across the server boundary. The full field schema
 * (`GET /api/content-schema/:name`) lands with the entry editor milestone.
 */

/** Multi-entry collection vs. standalone page — matches the server's `kind`. */
export type ContentTypeKind = 'collection' | 'single';

/** Wire shape of one content-type summary, as served by `GET /api/content-schema`. */
export type ContentTypeSummaryResponse = {
    name: string;
    kind: ContentTypeKind;
    label: string;
    description?: string;
    path?: string;
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
};
