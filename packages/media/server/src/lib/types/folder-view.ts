/**
 * The wire shape of a folder the API returns. `parentId` is `null` for a
 * top-level folder; `assetCount` is the number of assets directly inside it.
 */
export interface FolderView {
    id: string;
    name: string;
    parentId: string | null;
    assetCount: number;
    createdAt: string;
}

/**
 * The folders listing envelope. `rootAssetCount` is the number of assets at the
 * workspace root (no folder) — the admin's "All media" count, which has no
 * folder row to hang off.
 */
export interface FoldersView {
    folders: FolderView[];
    rootAssetCount: number;
}
