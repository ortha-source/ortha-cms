import { Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import type {
    MediaAssetResolver,
    ResolvedMediaAsset
} from '@orthacms/content-server';
import { mediaAsset } from '../schema/media-asset';
import { PublicAssetUrlsQuery } from '../public-urls/public-asset-urls';
import { assetUrlsFor, rawRoute } from './to-asset-view';

/**
 * Binds content-server's {@link MediaAssetResolver} port to the media schema:
 * a batched, workspace-scoped lookup of the facts content-server needs to
 * enforce a media field (existence + kind/MIME against the field's `accept`).
 * An id that names no asset in the workspace is simply omitted from the map, so
 * a missing and a cross-workspace asset are indistinguishable to the caller.
 *
 * The URLs are the ones {@link toAssetView} reports — the app's own raw-stream
 * route, or the provider's public URL when the deployment publishes the asset
 * — so a revision preview, a field control or an embedded image renders it
 * the same way the library does. A published asset also carries `public`,
 * which is what tells content's public API it may hand the URL to an anonymous
 * reader instead of rewriting it to the token route.
 */
@Injectable()
export class MediaAssetResolverQuery implements MediaAssetResolver {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly publicUrls: PublicAssetUrlsQuery
    ) {}

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
                alt: mediaAsset.alt,
                tracks: mediaAsset.tracks,
                variants: mediaAsset.variants,
                storageKey: mediaAsset.storageKey
            })
            .from(mediaAsset)
            .where(
                and(
                    inArray(mediaAsset.id, unique),
                    eq(mediaAsset.workspaceId, workspaceId)
                )
            );

        // One batch for every asset on the page; an empty map with the switch
        // off, without the provider ever being asked.
        const published = await this.publicUrls.forAssets(rows);

        for (const row of rows) {
            const publicUrls = published.get(row.id);
            // Derivatives come through the same `?variant=` route the
            // library's own tiles use (or their public URL), so a record's
            // media costs the editor a thumbnail, not an original.
            const { url, thumbUrl, previewUrl, streams } = assetUrlsFor(
                row.id,
                row.variants,
                publicUrls
            );
            result.set(row.id, {
                id: row.id,
                kind: row.kind,
                mimeType: row.mimeType,
                name: row.name,
                url,
                thumbUrl,
                previewUrl,
                alt: row.alt,
                // The track's `src` is the WebVTT asset's own raw route, not
                // this asset's — the pointer is stored as an id so the file
                // stays an ordinary library asset with its own permissions.
                // It stays on the app's route even when the deployment
                // publishes: `text/vtt` is outside the default MIME gate, and
                // resolving it would mean a second lookup per page.
                tracks: (row.tracks ?? []).map((track) => ({
                    kind: track.kind,
                    srclang: track.srclang,
                    label: track.label,
                    src: rawRoute(track.assetId),
                    ...(track.default ? { default: true as const } : {})
                })),
                ...(publicUrls
                    ? {
                          public: {
                              url: publicUrls.url,
                              ...(publicUrls.thumbUrl
                                  ? { thumbUrl: publicUrls.thumbUrl }
                                  : {}),
                              ...(publicUrls.previewUrl
                                  ? { previewUrl: publicUrls.previewUrl }
                                  : {}),
                              ...(streams ? { streams } : {})
                          }
                      }
                    : {})
            });
        }
        return result;
    }
}
