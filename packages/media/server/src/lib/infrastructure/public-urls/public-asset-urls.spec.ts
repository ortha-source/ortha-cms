import type {
    PublicAssetUrls,
    PublicUrlContext,
    StorageProvider
} from '@orthacms/media-domain';
import {
    PublicAssetUrlsQuery,
    isAbsoluteHttpUrl,
    mayPublish,
    type PublicUrlsConfig,
    type PublicUrlSubject
} from './public-asset-urls';

/** A provider that publishes every key under a pretend CDN, and records calls. */
function publishingProvider(
    answer: (
        key: string,
        context: PublicUrlContext
    ) => PublicAssetUrls | undefined | Promise<PublicAssetUrls | undefined> = (
        key
    ) => ({
        url: `https://cdn.test/${key}`
    })
) {
    const calls: Array<{ key: string; context: PublicUrlContext }> = [];
    const provider = {
        id: 'cdn',
        capabilities: {
            directUrl: false,
            contentTypeMetadata: true,
            streamingPut: true,
            publicUrls: true
        },
        publicUrls: (key: string, context: PublicUrlContext) => {
            calls.push({ key, context });
            return answer(key, context);
        }
    } as unknown as StorageProvider;
    return { provider, calls };
}

const ON: PublicUrlsConfig = { mode: 'provider', types: 'inline-safe' };
const OFF: PublicUrlsConfig = { mode: 'off', types: 'inline-safe' };

const png = (overrides: Partial<PublicUrlSubject> = {}): PublicUrlSubject => ({
    id: 'a1',
    storageKey: 'ws/a1/logo.png',
    mimeType: 'image/png',
    kind: 'image',
    variants: {
        thumb: { key: 'ws/a1/variants/thumb.webp' },
        preview: { key: 'ws/a1/variants/preview.webp' }
    },
    ...overrides
});

const svg = (): PublicUrlSubject => ({
    id: 's1',
    storageKey: 'ws/s1/icon.svg',
    mimeType: 'image/svg+xml',
    kind: 'image',
    variants: {}
});

const video = (): PublicUrlSubject => ({
    id: 'v1',
    storageKey: 'ws/v1/clip.mp4',
    mimeType: 'video/mp4',
    kind: 'video',
    variants: null
});

describe('PublicAssetUrlsQuery', () => {
    it('never asks the provider while the switch is off [media:I-41]', async () => {
        // The guarantee behind "off is byte-identical": not merely that the
        // answer is ignored, but that the provider is not consulted at all.
        const { provider, calls } = publishingProvider();
        const query = new PublicAssetUrlsQuery(provider, OFF);

        await expect(query.forAssets([png(), video()])).resolves.toEqual(
            new Map()
        );
        expect(calls).toEqual([]);
        expect(query.enabled).toBe(false);
    });

    it('reports nothing for a provider that does not declare the capability', async () => {
        const { provider, calls } = publishingProvider();
        const query = new PublicAssetUrlsQuery(
            {
                ...provider,
                capabilities: { ...provider.capabilities, publicUrls: false }
            },
            ON
        );

        await expect(query.forAssets([png()])).resolves.toEqual(new Map());
        expect(calls).toEqual([]);
    });

    it('asks for the original and each derivative under its own key', async () => {
        const { provider, calls } = publishingProvider();
        const query = new PublicAssetUrlsQuery(provider, ON);

        const result = await query.forAssets([png()]);

        expect(result.get('a1')).toEqual({
            url: 'https://cdn.test/ws/a1/logo.png',
            thumbUrl: 'https://cdn.test/ws/a1/variants/thumb.webp',
            previewUrl: 'https://cdn.test/ws/a1/variants/preview.webp'
        });
        expect(calls).toEqual([
            {
                key: 'ws/a1/logo.png',
                context: { mimeType: 'image/png', kind: 'image' }
            },
            {
                key: 'ws/a1/variants/thumb.webp',
                context: {
                    mimeType: 'image/webp',
                    kind: 'image',
                    variant: 'thumb'
                }
            },
            {
                key: 'ws/a1/variants/preview.webp',
                context: {
                    mimeType: 'image/webp',
                    kind: 'image',
                    variant: 'preview'
                }
            }
        ]);
    });

    it('leaves a derivative the provider does not publish to the app route', async () => {
        const { provider } = publishingProvider((key, context) =>
            context.variant ? undefined : { url: `https://cdn.test/${key}` }
        );
        const query = new PublicAssetUrlsQuery(provider, ON);

        expect((await query.forAssets([png()])).get('a1')).toEqual({
            url: 'https://cdn.test/ws/a1/logo.png'
        });
    });

    it('reports a video’s poster and streams from the provider', async () => {
        const { provider } = publishingProvider((key) => ({
            url: `https://video.test/${key}`,
            thumbnailUrl: `https://video.test/${key}/poster.jpg`,
            streams: {
                hls: `https://video.test/${key}/manifest/video.m3u8`,
                dash: `https://video.test/${key}/manifest/video.mpd`
            }
        }));
        const query = new PublicAssetUrlsQuery(provider, ON);

        expect((await query.forAssets([video()])).get('v1')).toEqual({
            url: 'https://video.test/ws/v1/clip.mp4',
            thumbUrl: 'https://video.test/ws/v1/clip.mp4/poster.jpg',
            streams: {
                hls: 'https://video.test/ws/v1/clip.mp4/manifest/video.m3u8',
                dash: 'https://video.test/ws/v1/clip.mp4/manifest/video.mpd'
            }
        });
    });

    it('prefers the core’s own thumb derivative over the provider’s poster', async () => {
        const { provider } = publishingProvider((key) => ({
            url: `https://cdn.test/${key}`,
            thumbnailUrl: 'https://cdn.test/poster.jpg'
        }));
        const query = new PublicAssetUrlsQuery(provider, ON);

        expect((await query.forAssets([png()])).get('a1')?.thumbUrl).toBe(
            'https://cdn.test/ws/a1/variants/thumb.webp'
        );
    });

    it('holds back an SVG under the default MIME gate, without asking [media:I-43]', async () => {
        // A CDN serves it without `nosniff`, the sandboxing CSP or the
        // attachment disposition, so a scripted SVG would run on its origin.
        const { provider, calls } = publishingProvider();
        const query = new PublicAssetUrlsQuery(provider, ON);

        const result = await query.forAssets([svg(), png()]);

        expect(result.has('s1')).toBe(false);
        expect(result.has('a1')).toBe(true);
        expect(calls.map((call) => call.key)).not.toContain('ws/s1/icon.svg');
    });

    it('publishes every type when the operator says the CDN hardens them', async () => {
        const { provider } = publishingProvider();
        const query = new PublicAssetUrlsQuery(provider, {
            mode: 'provider',
            types: 'all'
        });

        expect((await query.forAssets([svg()])).get('s1')).toEqual({
            url: 'https://cdn.test/ws/s1/icon.svg'
        });
    });

    it('falls back to the app route when the provider throws or rejects [media:I-44]', async () => {
        const { provider } = publishingProvider((key) => {
            if (key.endsWith('logo.png')) throw new Error('CDN config missing');
            return Promise.reject(new Error('lookup failed'));
        });
        const query = new PublicAssetUrlsQuery(provider, ON);

        await expect(query.forAssets([png(), video()])).resolves.toEqual(
            new Map()
        );
    });

    it('drops anything that is not an absolute http(s) URL [media:I-44]', async () => {
        // A `javascript:` or relative value would end up in a published
        // `<img src>`; the app's own route is the safe answer.
        const { provider } = publishingProvider((key) =>
            key.endsWith('.mp4')
                ? {
                      url: 'https://video.test/v1',
                      thumbnailUrl: 'javascript:alert(1)',
                      streams: { hls: '/relative.m3u8' }
                  }
                : { url: 'javascript:alert(1)' }
        );
        const query = new PublicAssetUrlsQuery(provider, ON);

        const result = await query.forAssets([png(), video()]);

        expect(result.has('a1')).toBe(false);
        expect(result.get('v1')).toEqual({ url: 'https://video.test/v1' });
    });

    it('issues every call for a page before awaiting any [media:I-46]', async () => {
        // An async provider must cost one round of latency per page, not one
        // per row: all calls are in flight before the first one settles.
        let inFlight = 0;
        let peak = 0;
        const { provider } = publishingProvider(async (key) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await new Promise((resolve) => setImmediate(resolve));
            inFlight -= 1;
            return { url: `https://cdn.test/${key}` };
        });
        const query = new PublicAssetUrlsQuery(provider, ON);
        const page = Array.from({ length: 5 }, (_, index) =>
            png({ id: `a${index}`, storageKey: `ws/a${index}/logo.png` })
        );

        const result = await query.forAssets(page);

        expect(result.size).toBe(5);
        // Five originals plus two derivatives each.
        expect(peak).toBe(15);
    });

    it('does not read an inherited property as a derivative', async () => {
        const { provider, calls } = publishingProvider();
        const query = new PublicAssetUrlsQuery(provider, ON);

        await query.forAssets([png({ variants: {} })]);

        expect(calls).toHaveLength(1);
    });
});

describe('mayPublish', () => {
    it.each([
        ['image/png', true],
        ['image/jpeg', true],
        ['video/mp4', true],
        ['audio/mpeg', true],
        ['application/pdf', true],
        ['image/svg+xml', false],
        ['text/html', false],
        ['application/octet-stream', false]
    ])('%s under inline-safe → %s [media:I-43]', (mimeType, expected) => {
        expect(mayPublish(ON, mimeType)).toBe(expected);
    });

    it('is false for every type while off', () => {
        expect(mayPublish(OFF, 'image/png')).toBe(false);
        expect(mayPublish({ mode: 'off', types: 'all' }, 'image/png')).toBe(
            false
        );
    });
});

describe('isAbsoluteHttpUrl', () => {
    it.each([
        ['https://cdn.test/a.png', true],
        ['http://cdn.test/a.png', true],
        ['/api/media/assets/x/raw', false],
        ['//cdn.test/a.png', false],
        ['javascript:alert(1)', false],
        ['data:image/png;base64,AAAA', false],
        ['', false],
        [undefined, false]
    ])('%s → %s', (value, expected) => {
        expect(isAbsoluteHttpUrl(value)).toBe(expected);
    });
});
