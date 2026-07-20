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
