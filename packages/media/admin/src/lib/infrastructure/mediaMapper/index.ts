import { ROOT_FOLDER_ID, type MediaKind } from '../../constants';
import type { MediaAsset } from '../../types/mediaAsset';
import type { MediaFolder } from '../../types/mediaFolder';

/**
 * Wire shape of an asset from the media API (mirrors the server's `AssetView`).
 * The admin restates it locally — it can't import the server package across the
 * module boundary.
 */
export type AssetResponse = {
    id: string;
    name: string;
    folderId: string | null;
    kind: string;
    mimeType: string;
    size: number;
    url: string;
    width: number | null;
    height: number | null;
    duration: number | null;
    tags: string[];
    alt: string | null;
    uploadedBy: string;
    createdAt: string;
    updatedAt: string;
};

/** Wire shape of a folder (mirrors the server's `FolderView`). */
export type FolderResponse = {
    id: string;
    name: string;
    parentId: string | null;
    assetCount: number;
    createdAt: string;
};

/** The folders listing envelope (mirrors the server's `FoldersView`). */
export type FoldersResponse = {
    folders: FolderResponse[];
    rootAssetCount: number;
};

/** One page of assets (mirrors the server's `AssetListView`). */
export type AssetListResponse = {
    items: AssetResponse[];
    total: number;
    page: number;
    pageSize: number;
};

/** Maps a wire folder to the admin model; a null parent → the root sentinel. */
export function toMediaFolder(dto: FolderResponse): MediaFolder {
    return {
        id: dto.id,
        name: dto.name,
        parentId: dto.parentId ?? ROOT_FOLDER_ID,
        createdAt: dto.createdAt
    };
}

/** Maps a wire asset to the admin model; a null folder → the root sentinel. */
export function toMediaAsset(dto: AssetResponse): MediaAsset {
    return {
        id: dto.id,
        name: dto.name,
        kind: dto.kind as MediaKind,
        url: dto.url,
        mimeType: dto.mimeType,
        size: dto.size,
        folderId: dto.folderId ?? ROOT_FOLDER_ID,
        dimensions:
            dto.width !== null && dto.height !== null
                ? { width: dto.width, height: dto.height }
                : undefined,
        duration: dto.duration ?? undefined,
        tags: dto.tags,
        alt: dto.alt ?? undefined,
        uploadedBy: dto.uploadedBy,
        createdAt: dto.createdAt,
        updatedAt: dto.updatedAt
    };
}
