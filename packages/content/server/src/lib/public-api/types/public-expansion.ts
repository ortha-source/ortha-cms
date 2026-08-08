/**
 * Wire contracts for the public API's **relation** and **media** expansions.
 * Separate from the admin's `RelationRef` / `MediaRef` for the same reason
 * `PublicEntry` is separate from `EntryRecord`: this is a published contract,
 * and it deliberately carries less.
 */

/** One linked entry, as the public API describes it. */
export interface PublicRelationRef {
    /** The linked entry's id — read it in full at `/v1/content/<type>/<id>`. */
    id: string;
    /** Display title: the target's first text/select field, else its id. */
    title: string;
    /**
     * The target's slug-field value, when it has one and it is non-empty.
     * Absent otherwise.
     */
    slug?: string;
}

/**
 * One relation field's links: a capped page plus the true total.
 *
 * `status` is not carried (the public API resolves published targets only, so
 * it would be a constant) and neither is the admin's `missing` flag: a target
 * a public caller may not see is **omitted and not counted**, rather than
 * advertised as an unavailable record. So unlike the admin's view, `items` may
 * legitimately be shorter than the stored link count — `total` is the number of
 * *visible* links.
 */
export interface PublicRelationFieldView {
    items: PublicRelationRef[];
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
