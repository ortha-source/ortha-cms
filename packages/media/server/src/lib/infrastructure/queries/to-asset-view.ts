import type { AssetRow } from '../persistence/asset.mapper';
import type { AssetPublicUrls } from '../public-urls/public-asset-urls';
import type { AssetView } from '../../types/asset-view';

/**
 * The download route for an asset's bytes. The global prefix is a fixed `api`
 * and the media controller mounts at `media`, so the raw route is stable; the
 * app streams the blob through the resolved provider.
 */
export function rawRoute(id: string): string {
    return `/api/media/assets/${id}/raw`;
}

/** The URLs one asset is reported under, on every surface that reports one. */
export interface AssetUrls {
    url: string;
    thumbUrl?: string;
    previewUrl?: string;
    streams?: { hls?: string; dash?: string };
}

/**
 * Where an asset and its derivatives are fetched from: the provider's public
 * URL where the deployment publishes one (`publicUrls`, from
 * `PublicAssetUrlsQuery`), else the app's own authorized route.
 *
 * A derivative URL is reported only when that derivative exists — except that a
 * provider's own poster (`thumbUrl` for a video, which has no derivative) is
 * reported when the provider has one.
 */
export function assetUrlsFor(
    id: string,
    variants: Record<string, unknown> | null,
    publicUrls?: AssetPublicUrls
): AssetUrls {
    const raw = rawRoute(id);
    const stored = variants ?? {};
    const variantRoute = (name: string) =>
        Object.hasOwn(stored, name) ? `${raw}?variant=${name}` : undefined;
    const thumbUrl = publicUrls?.thumbUrl ?? variantRoute('thumb');
    const previewUrl = publicUrls?.previewUrl ?? variantRoute('preview');
    return {
        url: publicUrls?.url ?? raw,
        ...(thumbUrl ? { thumbUrl } : {}),
        ...(previewUrl ? { previewUrl } : {}),
        ...(publicUrls?.streams ? { streams: publicUrls.streams } : {})
    };
}

/**
 * Maps a `media_asset` row to the wire {@link AssetView}. `uploaderName` is the
 * resolved display name of the uploader (the row stores only the user id);
 * `publicUrls` is the asset's entry from `PublicAssetUrlsQuery`, absent unless
 * the deployment publishes it.
 */
export function toAssetView(
    row: AssetRow,
    uploaderName: string,
    publicUrls?: AssetPublicUrls
): AssetView {
    return {
        id: row.id,
        name: row.name,
        folderId: row.folderId,
        kind: row.kind,
        mimeType: row.mimeType,
        size: row.size,
        ...assetUrlsFor(row.id, row.variants, publicUrls),
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
