/**
 * The media Insights read models, restated from the server's view contracts —
 * the admin can't import across the app boundary, exactly as with every other
 * wire type in this package.
 */

/** Storage used by one media kind. */
export type MediaKindUsage = {
    /** `image` · `video` · `audio` · `document` · `archive`. */
    kind: string;
    count: number;
    bytes: number;
};

/** What the workspace's media library is made of. */
export type MediaStorage = {
    kinds: MediaKindUsage[];
    totalBytes: number;
    totalCount: number;
};

/** Assets uploaded per time bucket. */
export type MediaUploads = {
    points: { bucket: string; value: number }[];
    granularity: 'day' | 'week' | 'month';
    total: number;
};

/** Alt-text coverage across the workspace's images. */
export type MediaAltCoverage = {
    images: number;
    withAlt: number;
    missing: number;
};

/**
 * The port over the media Insights endpoints — one method per widget, mirroring
 * one route per widget. {@link httpMediaInsightsGateway} is the implementation.
 */
/** One image with no alt text. */
export type MediaAltMissingAsset = {
    id: string;
    name: string;
    folderId: string | null;
    /** Who uploaded it — resolved against the workspace roster. */
    uploadedBy: string;
    /** ISO upload timestamp. */
    createdAt: string;
};

/** The images behind the "missing alt text" figure, oldest upload first. */
export type MediaAltMissing = {
    total: number;
    assets: MediaAltMissingAsset[];
};

export type MediaInsightsGateway = {
    /** `GET /insights/media/storage` — assets and bytes per kind. */
    storage(): Promise<MediaStorage>;
    /** `GET /insights/media/uploads` — assets added per bucket. */
    uploads(days: number): Promise<MediaUploads>;
    /** `GET /insights/media/alt` — alt-text coverage across images. */
    altCoverage(): Promise<MediaAltCoverage>;
    /** `GET /insights/media/alt/missing` — the images, oldest upload first. */
    altMissing(limit: number): Promise<MediaAltMissing>;
};
