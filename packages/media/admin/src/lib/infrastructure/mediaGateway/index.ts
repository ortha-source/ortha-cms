import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';

/** Folders plus a per-folder asset-count map (keyed by folder id + root). */
export type MediaFoldersResult = {
    folders: MediaFolder[];
    /** folder id → direct asset count, including `ROOT_FOLDER_ID` for the root. */
    folderCounts: Map<string, number>;
};

/** Create-folder input. `parentId` is an admin folder id or the root sentinel. */
export type CreateFolderInput = { name: string; parentId: string };

/** Rename input for a folder or an asset. */
export type RenameInput = { id: string; name: string };

/** Move input — the target folder is an admin id or the root sentinel. */
export type MoveAssetsInput = { ids: string[]; folderId: string };

/**
 * The port over the media API — the single seam the plugin talks to instead of
 * `apiClient` directly. Every method takes/returns the admin's models (root is
 * the `ROOT_FOLDER_ID` sentinel, translated to `null` at the wire). The `http*`
 * implementation is the only place `apiClient` is used.
 */
export type MediaGateway = {
    listFolders(): Promise<MediaFoldersResult>;
    listAssets(folderId: string): Promise<MediaAsset[]>;
    createFolder(input: CreateFolderInput): Promise<void>;
    renameFolder(input: RenameInput): Promise<void>;
    deleteFolder(id: string): Promise<void>;
    uploadFiles(folderId: string, files: File[]): Promise<void>;
    renameAsset(input: RenameInput): Promise<void>;
    moveAssets(input: MoveAssetsInput): Promise<void>;
    duplicateAssets(ids: string[]): Promise<void>;
    deleteAssets(ids: string[]): Promise<void>;
};
