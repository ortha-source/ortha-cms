import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { mediaAsset } from '../schema/media-asset';
import { PublicAssetUrlsQuery } from '../public-urls/public-asset-urls';
import type { AssetView } from '../../types/asset-view';
import { toAssetView } from './to-asset-view';
import { resolveUploaderNames, UNKNOWN_UPLOADER } from './uploader-names';

/** Reads a single asset as its wire {@link AssetView} (post-write refetch). */
@Injectable()
export class AssetViewQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly publicUrls: PublicAssetUrlsQuery
    ) {}

    /** Loads one asset within `workspaceId`, or `null` when absent. */
    async byId(id: string, workspaceId: string): Promise<AssetView | null> {
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
        const [names, published] = await Promise.all([
            resolveUploaderNames(this.db, [row.uploadedBy]),
            this.publicUrls.forAssets([row])
        ]);
        return toAssetView(
            row,
            names.get(row.uploadedBy) ?? UNKNOWN_UPLOADER,
            published.get(row.id)
        );
    }
}
