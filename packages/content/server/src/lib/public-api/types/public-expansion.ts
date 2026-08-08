import type { PublicEntry } from './public-entry';

/**
 * Wire contracts for the public API's **relation** and **media** expansions.
 * Separate from the admin's `RelationRef` / `MediaRef` for the same reason
 * `PublicEntry` is separate from `EntryRecord`: this is a published contract,
 * and it deliberately carries less.
 */

/**
 * One relation field's links: a capped page of the linked entries, plus the
 * true total.
 *
 * Each item is a **full {@link PublicEntry}** — the same shape the entry routes
 * return, envelope and `values` alike — so a consumer renders a linked record
 * with the code it already has instead of a second, ref-shaped model. Linked
 * entries are **not themselves expanded**: their `relations` and `media` are
 * absent, which is what stops one request walking the whole graph.
 *
 * Only published, non-deleted targets in the workspace appear. A target the
 * caller may not see is **omitted and not counted**, rather than advertised as
 * an unavailable record, so `total` is the number of links actually reachable.
 */
export interface PublicRelationFieldView {
    items: PublicEntry[];
    /** Visible links for this field, ignoring the page cap. */
    total: number;
}

/**
 * One media asset attached to an entry.
 *
 * **The URLs are the CMS's own media routes, which require an authenticated
 * session** — a bearer token cannot fetch them, and a browser `<img src>`
 * pointing at one will not load for an anonymous visitor. They are returned
 * because they identify the asset and are correct for a server-side caller that
 * holds a session; a token-fetchable URL needs either a token-authenticated
 * media route or signed URLs, neither of which exists yet. Treat `url` as a
 * reference, not a guarantee of access.
 */
export interface PublicMediaRef {
    /** Asset id. */
    id: string;
    /** Display name — the original file name. */
    name: string;
    /** Route the bytes stream from. See the caveat above. */
    url: string;
    /** Route for the ~320px derivative, when one was generated. */
    thumbUrl?: string;
    /** Route for the ~1280px derivative, when one was generated. */
    previewUrl?: string;
    /** Coarse kind — image / video / audio / document / archive. */
    kind: string;
    /** MIME type, e.g. `image/png`. */
    mimeType: string;
    /** Alt text, when set. */
    alt: string | null;
}

/** One media field's assets, in their stored order. */
export interface PublicMediaFieldView {
    items: PublicMediaRef[];
    /** Assets attached to this field. */
    total: number;
}
