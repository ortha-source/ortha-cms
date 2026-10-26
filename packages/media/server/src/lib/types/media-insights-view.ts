/**
 * Read-side view shapes for the media Insights widgets. Transport contracts,
 * restated verbatim by `media-admin`.
 */

/** Storage used by one media kind. */
export interface MediaKindUsageView {
    /** `image` · `video` · `audio` · `document` · `archive`. */
    kind: string;
    /** How many assets of this kind the workspace holds. */
    count: number;
    /** Bytes they occupy. */
    bytes: number;
}

/**
 * What the workspace's media library is made of.
 *
 * Carries both `count` and `bytes` per kind because they routinely tell
 * opposite stories — a handful of videos can be most of the bill while images
 * are most of the library — and a widget that only had one of them would let a
 * reader draw the wrong conclusion with confidence.
 */
export interface MediaStorageView {
    /** One row per kind that has at least one asset, largest by bytes first. */
    kinds: MediaKindUsageView[];
    /** Total bytes across every kind. */
    totalBytes: number;
    /** Total assets across every kind. */
    totalCount: number;
}

/** Assets uploaded per time bucket. */
export interface MediaUploadsView {
    /** The series, oldest bucket first. */
    points: { bucket: string; value: number }[];
    /** Bucket width, so the client can label the axis correctly. */
    granularity: 'day' | 'week' | 'month';
    /** Uploads across the whole window. */
    total: number;
}

/** Alt-text coverage across the workspace's images. */
export interface MediaAltCoverageView {
    /** Every image in the workspace. */
    images: number;
    /** Images carrying a non-empty `alt`. */
    withAlt: number;
    /** Images with no alt text — the number that needs work. */
    missing: number;
}

/** One image with no alt text, as the Insights drill-down lists it. */
export interface MediaAltMissingAssetView {
    /** Asset id. */
    id: string;
    /** The asset's file name. */
    name: string;
    /** Its folder, or `null` at the library root. */
    folderId: string | null;
    /** Who uploaded it — an id; the admin resolves it against its roster. */
    uploadedBy: string;
    /** ISO upload timestamp — the age the list is sorted by. */
    createdAt: string;
}

/** The images behind the "missing alt text" figure, oldest upload first. */
export interface MediaAltMissingView {
    /** Every image missing alt text, not only the listed ones. */
    total: number;
    /** The oldest uploads first, capped at the requested limit. */
    assets: MediaAltMissingAssetView[];
}
