import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { and, eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import {
    STORAGE_REGISTRY,
    type StorageRegistry
} from '../../domain/storage-provider';
import { mediaAsset } from '../schema/media-asset';

/** A ready-to-stream asset download resolved through its storage provider. */
export interface AssetDownload {
    stream: Readable;
    mimeType: string;
    name: string;
    size: number;
}

/**
 * Resolves an asset's bytes for the download route. Looks the asset up
 * (workspace-scoped), then streams from the provider that actually holds it —
 * routing by the stored `storageProvider`, never by re-running the resolver.
 */
@Injectable()
export class DownloadAssetQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @Inject(STORAGE_REGISTRY) private readonly registry: StorageRegistry
    ) {}

    /** Opens the byte stream for one asset, or `null` when absent. */
    async byId(id: string, workspaceId: string): Promise<AssetDownload | null> {
        const [row] = await this.db
            .select()
            .from(mediaAsset)
            .where(
                and(
                    eq(mediaAsset.id, id),
                    eq(mediaAsset.workspaceId, workspaceId)
                )
            )
            .limit(1);
        if (!row) return null;

        const provider = this.registry.get(row.storageProvider);
        const stream = await provider.get(row.storageKey);
        return {
            stream,
            mimeType: row.mimeType,
            name: row.name,
            size: row.size
        };
    }
}
