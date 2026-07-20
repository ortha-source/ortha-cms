/**
 * The wire shape of an asset the API returns to the admin — mirrors the
 * `MediaAsset` the admin store consumes. `url` is the app's own download route;
 * `folderId` is `null` at the workspace root.
 */
export interface AssetView {
    id: string;
    name: string;
    folderId: string | null;
    kind: string;
    mimeType: string;
    size: number;
    /** Route the browser fetches to stream the bytes. */
    url: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    tags: string[];
    alt: string | null;
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
