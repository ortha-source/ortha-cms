import type { Database } from '@orthacms/database';
import type { PublicUrlContext, StorageProvider } from '@orthacms/media-domain';
import {
    PublicAssetUrlsQuery,
    type PublicUrlsConfig
} from '../public-urls/public-asset-urls';
import { MediaAssetResolverQuery } from './media-asset-resolver.query';

const WS = '11111111-1111-4111-8111-111111111111';
const IMAGE = '22222222-2222-4222-8222-222222222222';
const VIDEO = '33333333-3333-4333-8333-333333333333';
const SVG = '44444444-4444-4444-8444-444444444444';
const VTT = '55555555-5555-4555-8555-555555555555';

/** The rows the resolver's one `select` returns. */
const ROWS = [
    {
        id: IMAGE,
        kind: 'image',
        mimeType: 'image/png',
        name: 'logo.png',
        alt: 'Logo',
        tracks: [],
        variants: {
            thumb: { key: 'k/image/thumb', width: 1, height: 1, size: 1 },
            preview: { key: 'k/image/preview', width: 1, height: 1, size: 1 }
        },
        storageKey: 'k/image'
    },
    {
        id: VIDEO,
        kind: 'video',
        mimeType: 'video/mp4',
        name: 'clip.mp4',
        alt: null,
        tracks: [
            {
                kind: 'captions',
                srclang: 'en',
                label: 'English',
                assetId: VTT,
                default: true
            }
        ],
        variants: {},
        storageKey: 'k/video'
    },
    {
        id: SVG,
        kind: 'image',
        mimeType: 'image/svg+xml',
        name: 'icon.svg',
        alt: null,
        tracks: [],
        variants: {},
        storageKey: 'k/svg'
    }
];

/** A `db` whose `select().from().where()` resolves to {@link ROWS}. */
function fakeDb(): Database {
    const chain = {
        from: () => chain,
        where: () => Promise.resolve(ROWS)
    };
    return { select: () => chain } as unknown as Database;
}

/** A provider publishing every key, with a poster + streams for the video. */
function cdn(): StorageProvider {
    return {
        id: 'cdn',
        capabilities: {
            directUrl: false,
            contentTypeMetadata: true,
            streamingPut: true,
            publicUrls: true
        },
        publicUrls: (key: string, context: PublicUrlContext) =>
            context.kind === 'video'
                ? {
                      url: `https://video.test/${key}`,
                      thumbnailUrl: `https://video.test/${key}/poster.jpg`,
                      streams: {
                          hls: `https://video.test/${key}/video.m3u8`,
                          dash: `https://video.test/${key}/video.mpd`
                      }
                  }
                : { url: `https://cdn.test/${key}` }
    } as unknown as StorageProvider;
}

function resolver(config: PublicUrlsConfig) {
    return new MediaAssetResolverQuery(
        fakeDb(),
        new PublicAssetUrlsQuery(cdn(), config)
    );
}

describe('MediaAssetResolverQuery', () => {
    it('reports the app’s routes and no `public` block while off [media:I-41]', async () => {
        const result = await resolver({
            mode: 'off',
            types: 'inline-safe'
        }).resolve([IMAGE, VIDEO, SVG], WS);

        // The exact 0.9.1 shape: raw routes, `?variant=` derivatives.
        expect(result.get(IMAGE)).toEqual({
            id: IMAGE,
            kind: 'image',
            mimeType: 'image/png',
            name: 'logo.png',
            url: `/api/media/assets/${IMAGE}/raw`,
            thumbUrl: `/api/media/assets/${IMAGE}/raw?variant=thumb`,
            previewUrl: `/api/media/assets/${IMAGE}/raw?variant=preview`,
            alt: 'Logo',
            tracks: []
        });
        expect(result.get(VIDEO)).toEqual({
            id: VIDEO,
            kind: 'video',
            mimeType: 'video/mp4',
            name: 'clip.mp4',
            url: `/api/media/assets/${VIDEO}/raw`,
            thumbUrl: undefined,
            previewUrl: undefined,
            alt: null,
            tracks: [
                {
                    kind: 'captions',
                    srclang: 'en',
                    label: 'English',
                    src: `/api/media/assets/${VTT}/raw`,
                    default: true
                }
            ]
        });
        expect(result.get(SVG)).not.toHaveProperty('public');
    });

    it('reports public URLs for the original and its derivatives, and marks them public', async () => {
        const result = await resolver({
            mode: 'provider',
            types: 'inline-safe'
        }).resolve([IMAGE], WS);

        expect(result.get(IMAGE)).toMatchObject({
            url: 'https://cdn.test/k/image',
            thumbUrl: 'https://cdn.test/k/image/thumb',
            previewUrl: 'https://cdn.test/k/image/preview',
            public: {
                url: 'https://cdn.test/k/image',
                thumbUrl: 'https://cdn.test/k/image/thumb',
                previewUrl: 'https://cdn.test/k/image/preview'
            }
        });
    });

    it('carries a video’s poster and streams, and leaves its tracks on the app route', async () => {
        const asset = (
            await resolver({ mode: 'provider', types: 'inline-safe' }).resolve(
                [VIDEO],
                WS
            )
        ).get(VIDEO);

        expect(asset?.public).toEqual({
            url: 'https://video.test/k/video',
            thumbUrl: 'https://video.test/k/video/poster.jpg',
            streams: {
                hls: 'https://video.test/k/video/video.m3u8',
                dash: 'https://video.test/k/video/video.mpd'
            }
        });
        expect(asset?.tracks[0]?.src).toBe(`/api/media/assets/${VTT}/raw`);
    });

    it('keeps an SVG entirely on the app route under the default gate [media:I-43]', async () => {
        const asset = (
            await resolver({ mode: 'provider', types: 'inline-safe' }).resolve(
                [SVG],
                WS
            )
        ).get(SVG);

        expect(asset?.url).toBe(`/api/media/assets/${SVG}/raw`);
        expect(asset).not.toHaveProperty('public');
    });
});
