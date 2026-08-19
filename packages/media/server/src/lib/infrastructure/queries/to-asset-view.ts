import type { AssetRow } from '../persistence/asset.mapper';
import type { AssetView } from '../../types/asset-view';

/**
 * The download route for an asset's bytes. The global prefix is a fixed `api`
 * and the media controller mounts at `media`, so the raw route is stable; the
 * app streams the blob through the resolved provider. (S3 direct/signed URLs
 * can later replace this per-provider.)
 */
function rawRoute(id: string): string {
    return `/api/media/assets/${id}/raw`;
}

/**
 * Maps a `media_asset` row to the wire {@link AssetView}. `uploaderName` is the
 * resolved display name of the uploader (the row stores only the user id).
 */
export function toAssetView(row: AssetRow, uploaderName: string): AssetView {
    return {
        id: row.id,
        name: row.name,
        folderId: row.folderId,
        kind: row.kind,
        mimeType: row.mimeType,
        size: row.size,
        url: rawRoute(row.id),
        variants: Object.keys(row.variants ?? {}),
        width: row.width,
        height: row.height,
        duration: row.duration,
        tags: row.tags ?? [],
        alt: row.alt,
        tracks: row.tracks ?? [],
        uploadedBy: uploaderName,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString()
    };
}
