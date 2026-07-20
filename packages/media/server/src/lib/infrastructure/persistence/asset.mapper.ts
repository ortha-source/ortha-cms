import { Injectable } from '@nestjs/common';
import { Asset } from '../../domain/asset';
import type { MediaKindValue } from '../../domain/value-objects/media-kind';
import type { mediaAsset } from '../schema/media-asset';

/** A `media_asset` row as selected from the database. */
export type AssetRow = typeof mediaAsset.$inferSelect;

/**
 * Translates between the persisted `media_asset` row and the {@link Asset}
 * aggregate. Keeps the row shape out of the domain and the aggregate out of the
 * repository's query code.
 */
@Injectable()
export class AssetMapper {
    /** Rebuilds the aggregate from a row. */
    toDomain(row: AssetRow): Asset {
        return Asset.rehydrate({
            id: row.id,
            workspaceId: row.workspaceId,
            folderId: row.folderId,
            name: row.name,
            storageKey: row.storageKey,
            storageProvider: row.storageProvider,
            kind: row.kind as MediaKindValue,
            mimeType: row.mimeType,
            size: row.size,
            checksum: row.checksum,
            width: row.width,
            height: row.height,
            duration: row.duration,
            tags: row.tags ?? [],
            alt: row.alt,
            uploadedBy: row.uploadedBy
        });
    }

    /** The `media_asset` insert row for a brand-new aggregate. */
    toInsertRow(asset: Asset): typeof mediaAsset.$inferInsert {
        return {
            id: asset.id.value,
            workspaceId: asset.workspaceId,
            folderId: asset.folderId?.value ?? null,
            name: asset.name.value,
            kind: asset.kind.value,
            mimeType: asset.mimeType,
            size: asset.size,
            storageKey: asset.storageKey.value,
            storageProvider: asset.storageProvider,
            checksum: asset.checksum,
            width: asset.media.width,
            height: asset.media.height,
            duration: asset.media.duration,
            tags: asset.tags,
            alt: asset.alt,
            uploadedBy: asset.uploadedBy
        };
    }
}
