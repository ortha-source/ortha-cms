import type { Database } from '@orthacms/database';
import type {
    MediaAssetResolver,
    ResolvedMediaAsset
} from '../../extension/media-asset-resolver';
import type { RelationLinkService } from '../../entries/infrastructure/persistence/relation-link.service';
import type { AnyContentType } from '../../types/content-type';
import { PublicExpansionQuery } from './public-expansion.query';

const WS = '11111111-1111-4111-8111-111111111111';
const PRIVATE = '22222222-2222-4222-8222-222222222222';
const PUBLISHED = '33333333-3333-4333-8333-333333333333';
const VIDEO = '44444444-4444-4444-8444-444444444444';
const VTT = '55555555-5555-4555-8555-555555555555';

/** What the media plugin's resolver hands back for each asset. */
const ASSETS: ResolvedMediaAsset[] = [
    {
        // Not published — the deployment is off, or the type failed the gate.
        id: PRIVATE,
        kind: 'image',
        mimeType: 'image/svg+xml',
        name: 'icon.svg',
        url: `/api/media/assets/${PRIVATE}/raw`,
        thumbUrl: `/api/media/assets/${PRIVATE}/raw?variant=thumb`,
        alt: null,
        tracks: []
    },
    {
        id: PUBLISHED,
        kind: 'image',
        mimeType: 'image/png',
        name: 'logo.png',
        url: 'https://cdn.test/logo.png',
        thumbUrl: 'https://cdn.test/thumb.webp',
        // A derivative the provider does not publish: the resolver reports
        // the app route, and `public` carries no preview.
        previewUrl: `/api/media/assets/${PUBLISHED}/raw?variant=preview`,
        alt: 'Logo',
        tracks: [],
        public: {
            url: 'https://cdn.test/logo.png',
            thumbUrl: 'https://cdn.test/thumb.webp'
        }
    },
    {
        id: VIDEO,
        kind: 'video',
        mimeType: 'video/mp4',
        name: 'clip.mp4',
        url: 'https://video.test/v1',
        thumbUrl: 'https://video.test/v1/poster.jpg',
        alt: null,
        tracks: [
            {
                kind: 'captions',
                srclang: 'en',
                label: 'English',
                src: `/api/media/assets/${VTT}/raw`
            }
        ],
        public: {
            url: 'https://video.test/v1',
            thumbUrl: 'https://video.test/v1/poster.jpg',
            streams: {
                hls: 'https://video.test/v1/manifest/video.m3u8',
                dash: 'https://video.test/v1/manifest/video.mpd'
            }
        }
    }
];

const resolver: MediaAssetResolver = {
    resolve: async (ids) =>
        new Map(
            ASSETS.filter((asset) => ids.includes(asset.id)).map((asset) => [
                asset.id,
                asset
            ])
        )
};

const query = new PublicExpansionQuery(
    {} as Database,
    {} as RelationLinkService,
    resolver
);

/** The `?media=preview` items for one entry holding the given ids. */
async function itemsFor(ids: string[]) {
    const out = await query.mediaForRows(
        {} as AnyContentType,
        ['cover'],
        [{ id: 'entry-1', workspaceId: WS, cover: ids }],
        WS
    );
    return out.get('entry-1')?.['cover']?.items ?? [];
}

describe('PublicExpansionQuery.mediaForRows — URLs', () => {
    it('rewrites an unpublished asset to the token route, as before [media:I-45]', async () => {
        const [item] = await itemsFor([PRIVATE]);

        expect(item).toEqual({
            id: PRIVATE,
            name: 'icon.svg',
            url: `/api/v1/media/assets/${PRIVATE}/raw`,
            thumbUrl: `/api/v1/media/assets/${PRIVATE}/raw?variant=thumb`,
            kind: 'image',
            mimeType: 'image/svg+xml',
            alt: null,
            tracks: []
        });
    });

    it('reports a published asset’s public URLs as they are [media:I-45]', async () => {
        const [item] = await itemsFor([PUBLISHED]);

        expect(item).toMatchObject({
            url: 'https://cdn.test/logo.png',
            thumbUrl: 'https://cdn.test/thumb.webp',
            // Not public: the token route, never the admin's session route.
            previewUrl: `/api/v1/media/assets/${PUBLISHED}/raw?variant=preview`
        });
        expect(item).not.toHaveProperty('streams');
    });

    it('includes a published video’s poster and streams, and keeps tracks on the token route', async () => {
        const [item] = await itemsFor([VIDEO]);

        expect(item).toEqual({
            id: VIDEO,
            name: 'clip.mp4',
            url: 'https://video.test/v1',
            thumbUrl: 'https://video.test/v1/poster.jpg',
            streams: {
                hls: 'https://video.test/v1/manifest/video.m3u8',
                dash: 'https://video.test/v1/manifest/video.mpd'
            },
            kind: 'video',
            mimeType: 'video/mp4',
            alt: null,
            tracks: [
                {
                    kind: 'captions',
                    srclang: 'en',
                    label: 'English',
                    src: `/api/v1/media/assets/${VTT}/raw`
                }
            ]
        });
    });

    it('never trusts the resolver’s `url` alone — only `public` publishes [media:I-45]', async () => {
        // A resolver URL that merely *looks* absolute is still rewritten: the
        // decision to hand a reader an unauthenticated URL is the media
        // plugin's, carried by `public`, not inferred from a string's shape.
        const unmarked = new PublicExpansionQuery(
            {} as Database,
            {} as RelationLinkService,
            {
                resolve: async () =>
                    new Map([[PUBLISHED, { ...ASSETS[1], public: undefined }]])
            }
        );

        const out = await unmarked.mediaForRows(
            {} as AnyContentType,
            ['cover'],
            [{ id: 'entry-1', workspaceId: WS, cover: [PUBLISHED] }],
            WS
        );
        const [item] = out.get('entry-1')?.['cover']?.items ?? [];

        expect(item?.url).toBe(`/api/v1/media/assets/${PUBLISHED}/raw`);
        expect(item?.thumbUrl).toBe(
            `/api/v1/media/assets/${PUBLISHED}/raw?variant=thumb`
        );
    });
});
