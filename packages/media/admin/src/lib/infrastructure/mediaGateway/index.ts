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

/**
 * Partial update of an asset's descriptive metadata. `alt` is sent verbatim —
 * the server normalizes a blank string back to "no alt", so clearing the field
 * clears the description rather than storing whitespace that would count as
 * covered in the alt-coverage insight.
 */
export type UpdateAssetInput = { id: string; alt: string };

/** Move input — the target folder is an admin id or the root sentinel. */
export type MoveAssetsInput = { ids: string[]; folderId: string };

/**
 * One file queued for upload, with the description its author wrote for it.
 *
 * Alt text rides along with the bytes rather than waiting for a later edit:
 * the moment the author is looking at the image is the only moment they can
 * describe it cheaply, and an asset that lands with `alt: null` is one nothing
 * in the product will ever ask about again.
 */
export type StagedUpload = {
    file: File;
    /** Alt text for an image; omitted or blank means "not described". */
    alt?: string;
};

/** Per-request upload options — progress reporting and caller cancellation. */
export type UploadOptions = {
    /** Alt text stored on the created asset (blank/absent → no description). */
    alt?: string;
    /**
     * Called as the request body is written, with the whole-number percentage
     * of bytes sent (0–100). Axios only reports this while the browser is
     * uploading; the server's own processing time lands at 100% and waits.
     */
    onProgress?: (percent: number) => void;
    /** Aborts the in-flight request (the user cancelled the upload). */
    signal?: AbortSignal;
};

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
    /**
     * Uploads **one** file and returns the created asset (the server echoes its
     * view). The queue (concurrency, per-file progress, retries) is the
     * caller's — the gateway stays a thin one-request-per-call seam so a failure
     * maps to exactly one file. The upload-queue caller ignores the return; the
     * media-field picker uses it to set the field value to the new asset id.
     */
    uploadFile(
        folderId: string,
        file: File,
        options?: UploadOptions
    ): Promise<MediaAsset>;
    renameAsset(input: RenameInput): Promise<void>;
    /** Updates an asset's descriptive metadata (today: its alt text). */
    updateAsset(input: UpdateAssetInput): Promise<void>;
    moveAssets(input: MoveAssetsInput): Promise<void>;
    duplicateAssets(ids: string[]): Promise<void>;
    deleteAssets(ids: string[]): Promise<void>;
};
