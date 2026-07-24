import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import type {
    MediaAssetResolver,
    ResolvedMediaAsset
} from '@ortha-cms/content-server';
import { mediaAsset } from '../schema/media-asset';

/**
 * Binds content-server's {@link MediaAssetResolver} port to the media schema:
 * a batched, workspace-scoped lookup of the facts content-server needs to
 * enforce a media field (existence + kind/MIME against the field's `accept`).
 * An id that names no asset in the workspace is simply omitted from the map, so
 * a missing and a cross-workspace asset are indistinguishable to the caller.
 *
 * `url` is the app's own raw-stream route — the same one {@link toAssetView}
 * produces — so a revision preview or field control can render the asset.
 */
@Injectable()
export class MediaAssetResolverQuery implements MediaAssetResolver {
    constructor(@InjectDatabase() private readonly db: Database) {}

    async resolve(
        ids: readonly string[],
        workspaceId: string
    ): Promise<Map<string, ResolvedMediaAsset>> {
        const unique = [...new Set(ids)];
        const result = new Map<string, ResolvedMediaAsset>();
        if (!unique.length) return result;

        const rows = await this.db
            .select({
                id: mediaAsset.id,
                kind: mediaAsset.kind,
                mimeType: mediaAsset.mimeType,
                name: mediaAsset.name,
                alt: mediaAsset.alt
            })
            .from(mediaAsset)
            .where(
                and(
                    inArray(mediaAsset.id, unique),
                    eq(mediaAsset.workspaceId, workspaceId)
                )
            );

        for (const row of rows) {
            result.set(row.id, {
                id: row.id,
                kind: row.kind,
                mimeType: row.mimeType,
                name: row.name,
                url: `/api/media/assets/${row.id}/raw`,
                alt: row.alt
            });
        }
        return result;
    }
}
