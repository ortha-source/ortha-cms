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
 * By default the URLs point at `/api/v1/media/assets/:id/raw`, which takes the
 * **same bearer token** as the read that produced them — so a server-side
 * consumer can fetch the bytes with the credential it already has. They are
 * still not public: a browser `<img src>` sends no `Authorization` header, so an
 * anonymous visitor will not load one. Proxy them, or fetch and re-serve them,
 * from whatever is holding the token.
 *
 * A deployment that publishes its storage provider's CDN URLs (`publicUrls:
 * 'provider'` in the media config, ADR-0021) reports those instead, for the
 * assets it publishes — an absolute `https://` URL rather than a path is the
 * tell. Those need no token, and are reachable by anyone who holds them.
 */
export interface PublicMediaRef {
    /** Asset id. */
    id: string;
    /** Display name — the original file name. */
    name: string;
    /** Where the bytes are fetched. See the caveat above. */
    url: string;
    /**
     * The ~320px derivative, when one was generated — or, for a published
     * video, the storage provider's own poster frame.
     */
    thumbUrl?: string;
    /** The ~1280px derivative, when one was generated. */
    previewUrl?: string;
    /**
     * Adaptive streaming manifests (HLS / DASH), for a published video whose
     * storage provider transcodes. Absent otherwise.
     */
    streams?: PublicMediaStreams;
    /** Coarse kind — image / video / audio / document / archive. */
    kind: string;
    /** MIME type, e.g. `image/png`. */
    mimeType: string;
    /**
     * The text alternative for **this usage** — the entry value's own `alt`
     * where it has one, the asset row's default otherwise, and `''` when the
     * usage is {@link decorative}.
     *
     * `''` and `null` mean different things and a consumer should treat them
     * differently: `''` is "render `alt=\"\"`, this image says nothing", while
     * `null` is "nobody has supplied one" — which is a gap to report, not an
     * instruction to hide the image from assistive tech (`ORT-83`).
     */
    alt: string | null;
    /** The author marked this usage purely presentational. */
    decorative?: true;
    /**
     * Timed-text tracks for a video or audio asset — everything a consumer
     * needs to emit `<track>` elements. Empty for an image, and for a video
     * nobody has captioned (`ORT-92`).
     */
    tracks: PublicMediaTrack[];
}

/** Streaming manifests for a published video. Either may be absent. */
export interface PublicMediaStreams {
    /** HLS playlist (`.m3u8`). */
    hls?: string;
    /** MPEG-DASH manifest (`.mpd`). */
    dash?: string;
}

/** One timed-text track on a published video or audio asset. */
export interface PublicMediaTrack {
    /** `captions` / `subtitles` / `descriptions` / `chapters`. */
    kind: string;
    /** BCP-47 tag of the track's language. */
    srclang: string;
    /** The label a player shows in its track menu. */
    label: string;
    /** Route the WebVTT bytes stream from — same bearer token as the query. */
    src: string;
    /** Whether a player should enable this one by default. */
    default?: boolean;
}

/** One media field's assets, in their stored order. */
export interface PublicMediaFieldView {
    items: PublicMediaRef[];
    /** Assets attached to this field. */
    total: number;
}
