import { describe, expect, it } from 'vitest';
import { ROOT_FOLDER_ID } from '../../constants';
import { toMediaAsset, type AssetResponse } from './index';

const dto = (overrides: Partial<AssetResponse> = {}): AssetResponse => ({
    id: 'a1',
    name: 'logo.png',
    folderId: null,
    kind: 'image',
    mimeType: 'image/png',
    size: 9,
    url: '/api/media/assets/a1/raw',
    variants: ['thumb', 'preview'],
    width: 2000,
    height: 1250,
    duration: null,
    tags: [],
    alt: null,
    uploadedBy: 'Ada',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
});

describe('toMediaAsset', () => {
    it('takes the derivative URLs the server reports', () => {
        const asset = toMediaAsset(
            dto({
                url: 'https://cdn.test/logo.png',
                thumbUrl: 'https://cdn.test/thumb.webp',
                previewUrl: 'https://cdn.test/preview.webp'
            })
        );

        expect(asset.url).toBe('https://cdn.test/logo.png');
        expect(asset.thumbUrl).toBe('https://cdn.test/thumb.webp');
        expect(asset.previewUrl).toBe('https://cdn.test/preview.webp');
    });

    it('never appends ?variant= to a CDN url', () => {
        // The CDN ignores the query, so every tile would quietly load the full
        // original: the server's own route for the derivative is used instead.
        const asset = toMediaAsset(
            dto({
                url: 'https://cdn.test/logo.png',
                thumbUrl: '/api/media/assets/a1/raw?variant=thumb',
                previewUrl: '/api/media/assets/a1/raw?variant=preview'
            })
        );

        expect(asset.thumbUrl).toBe('/api/media/assets/a1/raw?variant=thumb');
        expect(asset.previewUrl).toBe(
            '/api/media/assets/a1/raw?variant=preview'
        );
    });

    it('derives ?variant= routes for a server that predates the fields', () => {
        const asset = toMediaAsset(dto());

        expect(asset.thumbUrl).toBe('/api/media/assets/a1/raw?variant=thumb');
        expect(asset.previewUrl).toBe(
            '/api/media/assets/a1/raw?variant=preview'
        );
    });

    it('reports no derivative the asset does not have', () => {
        const asset = toMediaAsset(dto({ variants: [] }));

        expect(asset.thumbUrl).toBeUndefined();
        expect(asset.previewUrl).toBeUndefined();
        expect(asset.folderId).toBe(ROOT_FOLDER_ID);
    });
});
