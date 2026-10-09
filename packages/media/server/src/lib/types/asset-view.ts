import type { StoredMediaTrack } from '../infrastructure/schema/media-asset';

/**
 * The wire shape of an asset the API returns to the admin — mirrors the
 * `MediaAsset` the admin store consumes. `url` is the app's own download route,
 * unless the deployment publishes the storage provider's public URLs
 * (ADR-0021); `folderId` is `null` at the workspace root.
 */
export interface AssetView {
    id: string;
    name: string;
    folderId: string | null;
    kind: string;
    mimeType: string;
    size: number;
    /**
     * Where the browser fetches the original bytes: the app's own authorized
     * route, or — when the deployment sets `publicUrls: 'provider'` and the
     * asset passes the MIME gate — the storage provider's permanent public URL.
     */
    url: string;
    /**
     * Where the ~320px derivative is fetched, when there is one: its public URL
     * or the app's `?variant=thumb` route. For a published video it may be the
     * provider's own poster frame instead. Absent otherwise.
     */
    thumbUrl?: string;
    /** Where the ~1280px derivative is fetched, same rules as {@link thumbUrl}. */
    previewUrl?: string;
    /**
     * Adaptive streaming manifests, for a published video whose provider
     * transcodes. Absent otherwise.
     */
    streams?: { hls?: string; dash?: string };
    /**
     * Names of the generated derivatives available for this asset (`thumb`,
     * `preview`). Read {@link thumbUrl} / {@link previewUrl} for where to fetch
     * them: `${url}?variant=<name>` only holds while `url` is the app's own
     * route. Empty for non-images or images too small to derive.
     */
    variants: string[];
    width: number | null;
    height: number | null;
    duration: number | null;
    tags: string[];
    alt: string | null;
    /**
     * Timed-text tracks attached to a video or audio asset — captions,
     * subtitles, descriptions, chapters. Empty for everything else (`ORT-92`).
     */
    tracks: StoredMediaTrack[];
    /** Display name of the uploader (resolved from the stored user id). */
    uploadedBy: string;
    createdAt: string;
    updatedAt: string;
}

/** One page of assets, matching the admin's paginated envelope. */
export interface AssetListView {
    items: AssetView[];
    total: number;
    page: number;
    pageSize: number;
}
