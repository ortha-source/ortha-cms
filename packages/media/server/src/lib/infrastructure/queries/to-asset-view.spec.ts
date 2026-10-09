import type { AssetRow } from '../persistence/asset.mapper';
import { assetUrlsFor, toAssetView } from './to-asset-view';

const ID = '22222222-2222-4222-8222-222222222222';

const row = (overrides: Partial<AssetRow> = {}): AssetRow =>
    ({
        id: ID,
        workspaceId: '11111111-1111-4111-8111-111111111111',
        folderId: null,
        name: 'logo.png',
        kind: 'image',
        mimeType: 'image/png',
        size: 9,
        storageProvider: 'memory',
        storageKey: `ws/${ID}/logo.png`,
        checksum: 'abc',
        variants: {
            thumb: { key: 'k/thumb', width: 320, height: 200, size: 1 },
            preview: { key: 'k/preview', width: 1280, height: 800, size: 2 }
        },
        width: 2000,
        height: 1250,
        duration: null,
        tags: [],
        alt: null,
        tracks: [],
        uploadedBy: 'u1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
        ...overrides
    }) as AssetRow;

describe('toAssetView', () => {
    it('reports the app’s own routes when nothing is published [media:I-41]', () => {
        const view = toAssetView(row(), 'Ada');

        expect(view.url).toBe(`/api/media/assets/${ID}/raw`);
        // Exactly what the admin used to derive from `url` itself.
        expect(view.thumbUrl).toBe(`/api/media/assets/${ID}/raw?variant=thumb`);
        expect(view.previewUrl).toBe(
            `/api/media/assets/${ID}/raw?variant=preview`
        );
        expect(view.variants).toEqual(['thumb', 'preview']);
        expect(view).not.toHaveProperty('streams');
    });

    it('omits derivative URLs an asset does not have', () => {
        const view = toAssetView(row({ variants: {} }), 'Ada');

        expect(view).not.toHaveProperty('thumbUrl');
        expect(view).not.toHaveProperty('previewUrl');
    });

    it('reports public URLs where the asset has them', () => {
        const view = toAssetView(row(), 'Ada', {
            url: 'https://cdn.test/logo.png',
            thumbUrl: 'https://cdn.test/thumb.webp',
            previewUrl: 'https://cdn.test/preview.webp'
        });

        expect(view).toMatchObject({
            url: 'https://cdn.test/logo.png',
            thumbUrl: 'https://cdn.test/thumb.webp',
            previewUrl: 'https://cdn.test/preview.webp'
        });
    });

    it('keeps the app route for a derivative the provider did not publish', () => {
        // `${url}?variant=thumb` would be a CDN URL with a query it ignores —
        // the full original, at tile size. The explicit field avoids that.
        const view = toAssetView(row(), 'Ada', {
            url: 'https://cdn.test/logo.png'
        });

        expect(view.url).toBe('https://cdn.test/logo.png');
        expect(view.thumbUrl).toBe(`/api/media/assets/${ID}/raw?variant=thumb`);
    });

    it('carries a published video’s poster and streams', () => {
        const view = toAssetView(
            row({ kind: 'video', mimeType: 'video/mp4', variants: {} }),
            'Ada',
            {
                url: 'https://video.test/v1',
                thumbUrl: 'https://video.test/v1/poster.jpg',
                streams: { hls: 'https://video.test/v1/video.m3u8' }
            }
        );

        expect(view).toMatchObject({
            url: 'https://video.test/v1',
            thumbUrl: 'https://video.test/v1/poster.jpg',
            streams: { hls: 'https://video.test/v1/video.m3u8' }
        });
        expect(view).not.toHaveProperty('previewUrl');
    });
});

describe('assetUrlsFor', () => {
    it('resolves a derivative by own property only [media:I-23]', () => {
        expect(assetUrlsFor(ID, {})).toEqual({
            url: `/api/media/assets/${ID}/raw`
        });
        expect(assetUrlsFor(ID, null)).toEqual({
            url: `/api/media/assets/${ID}/raw`
        });
    });
});
