import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import {
    STORAGE_REGISTRY,
    type StorageRegistry
} from '../../domain/storage-provider';
import { mediaAsset } from '../schema/media-asset';

/** Where an asset's bytes live, plus the workspace that owns it. */
export interface AssetLocation {
    /** The owning workspace — the authorization subject for the download. */
    workspaceId: string;
    storageProvider: string;
    storageKey: string;
    mimeType: string;
    name: string;
    size: number;
}

/**
 * Resolves an asset's bytes for the download route, in two steps so the caller
 * can authorize **between** them: {@link locate} is a metadata-only lookup that
 * reports the owning workspace, and {@link open} streams from the provider that
 * actually holds the blob — routing by the stored `storageProvider`, never by
 * re-running the resolver. Splitting them keeps storage untouched until the
 * caller has confirmed the requester may read it.
 */
@Injectable()
export class DownloadAssetQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @Inject(STORAGE_REGISTRY) private readonly registry: StorageRegistry
    ) {}

    /**
     * Looks an asset up by id alone — **unscoped**, because the download route
     * derives the workspace from the row instead of taking it from the caller
     * (an `<img>` tag can't send the `X-Workspace-Id` header). Returns `null`
     * when there is no such asset; the caller must still authorize the returned
     * `workspaceId` before opening the stream.
     */
    async locate(id: string): Promise<AssetLocation | null> {
        const [row] = await this.db
            .select({
                workspaceId: mediaAsset.workspaceId,
                storageProvider: mediaAsset.storageProvider,
                storageKey: mediaAsset.storageKey,
                mimeType: mediaAsset.mimeType,
                name: mediaAsset.name,
                size: mediaAsset.size
            })
            .from(mediaAsset)
            .where(eq(mediaAsset.id, id))
            .limit(1);
        return row ?? null;
    }

    /** Opens the byte stream for an already-authorized asset. */
    async open(location: AssetLocation): Promise<Readable> {
        const provider = this.registry.get(location.storageProvider);
        return provider.get(location.storageKey);
    }
}
