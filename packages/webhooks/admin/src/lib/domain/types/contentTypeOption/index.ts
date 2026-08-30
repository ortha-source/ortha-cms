/**
 * A content type as the endpoint editor's picker renders it — one row of the
 * code-defined registry (`GET /api/content-schema`).
 *
 * The picker is a convenience over a free-text filter, not a closed list: an
 * endpoint may legitimately name a type this build does not define yet.
 */
export type ContentTypeOption = {
    /** The machine name, which is what the subscription filter matches on. */
    name: string;
    /** The human label from the registry. */
    label: string;
};
