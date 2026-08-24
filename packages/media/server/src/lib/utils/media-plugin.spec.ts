import type { StorageProvider } from '../domain/storage-provider';
import type { MediaPluginConfig } from '../types/media-config';
import { MediaServerPlugin, type MediaPluginOptions } from './media-plugin';

const provider = (overrides: Partial<StorageProvider> = {}): StorageProvider =>
    ({
        id: 'local',
        capabilities: {
            directUrl: false,
            contentTypeMetadata: false,
            streamingPut: true
        },
        put: () => Promise.reject(new Error('not called')),
        get: () => Promise.reject(new Error('not called')),
        remove: () => Promise.resolve(),
        ...overrides
    }) as StorageProvider;

const config = (
    overrides: Partial<MediaPluginConfig> = {}
): MediaPluginConfig => ({
    maxUploadBytes: 52_428_800,
    ...overrides
});

const options = (
    overrides: Partial<MediaPluginOptions> = {}
): MediaPluginOptions => ({
    provider: provider(),
    config: config(),
    ...overrides
});

/**
 * The plugin validates its wiring eagerly, like `CopilotPlugin` does — because
 * the alternative is a per-request failure whose cause is nowhere in the message.
 *
 * The case that prompted these: pointing the shipped app at a backend nobody
 * had wired. The server booted silently and every upload answered a bare
 * `500 Internal server error`.
 */
describe('MediaServerPlugin()', () => {
    it('constructs with a storage provider', () => {
        expect(MediaServerPlugin(options()).name).toBe('media');
    });

    it('rejects a missing provider', () => {
        expect(() =>
            MediaServerPlugin(
                options({ provider: undefined as unknown as StorageProvider })
            )
        ).toThrow(/requires a storage provider/);
    });

    it('rejects a provider with no id — the value every asset row records', () => {
        expect(() =>
            MediaServerPlugin(options({ provider: provider({ id: '  ' }) }))
        ).toThrow(/non-empty `id`/);
    });

    it('rejects a provider that declares no capabilities', () => {
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: provider({
                        capabilities:
                            undefined as unknown as StorageProvider['capabilities']
                    })
                })
            )
        ).toThrow(/declares no `capabilities`/);
    });

    it('rejects a declared directUrl capability with no directUrl()', () => {
        // The download route would offer a redirect the provider cannot mint,
        // which is a 500 per image rather than a boot failure.
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: provider({
                        capabilities: {
                            directUrl: true,
                            contentTypeMetadata: true,
                            streamingPut: true
                        }
                    })
                })
            )
        ).toThrow(/declares `capabilities.directUrl` but implements/);
    });

    it('refuses signed-url serving on a backend that cannot sign', () => {
        // Silently proxying instead would leave the operator believing an
        // optimization is on that is not — and paying for the egress that was
        // the reason to switch backend.
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ directServe: 'signed-url' }) })
            )
        ).toThrow(/directUrl: false/);
    });

    it('accepts signed-url serving on a backend that can', () => {
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: provider({
                        capabilities: {
                            directUrl: true,
                            contentTypeMetadata: true,
                            streamingPut: true
                        },
                        directUrl: () => Promise.resolve('https://cdn.test/x')
                    }),
                    config: config({ directServe: 'signed-url' })
                })
            )
        ).not.toThrow();
    });

    it('rejects a signed-URL lifetime that is already expired', () => {
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ directServeTtlSeconds: 0 }) })
            )
        ).toThrow(/directServeTtlSeconds/);
    });

    it('rejects a non-positive upload cap, which would refuse every upload', () => {
        // Measured: `MEDIA_MAX_UPLOAD_BYTES=-1` booted and answered `413
        // Payload Too Large` to a 1 kB file. The host now rejects the value
        // too; this is the plugin refusing to be handed it by any caller.
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ maxUploadBytes: 0 }) })
            )
        ).toThrow(/maxUploadBytes/);
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ maxUploadBytes: -1 }) })
            )
        ).toThrow(/maxUploadBytes/);
    });

    it('still carries its own migrations descriptor', () => {
        // Validation runs before the descriptor is built, so a mistake in it
        // would take the plugin's migrations with it.
        expect(MediaServerPlugin(options()).migrations?.table).toBe(
            '__drizzle_migrations_media'
        );
    });
});
