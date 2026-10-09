import type { DynamicModule, ValueProvider } from '@nestjs/common';
import { STORAGE_PROVIDER, type StorageProvider } from '@orthacms/media-domain';
import type { MediaPluginConfig } from '../types/media-config';
import { PUBLIC_URLS } from '../infrastructure/public-urls/public-asset-urls';
import { MediaServerPlugin, type MediaPluginOptions } from './media-plugin';

const provider = (overrides: Partial<StorageProvider> = {}): StorageProvider =>
    ({
        id: 'local',
        capabilities: {
            directUrl: false,
            contentTypeMetadata: false,
            streamingPut: true,
            publicUrls: false
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

    it('rejects a provider with no id — the value every asset row records [media:I-03]', () => {
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

    it('rejects a declared directUrl capability with no directUrl() [media:I-05]', () => {
        // The download route would offer a redirect the provider cannot mint,
        // which is a 500 per image rather than a boot failure.
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: provider({
                        capabilities: {
                            directUrl: true,
                            contentTypeMetadata: true,
                            streamingPut: true,
                            publicUrls: false
                        }
                    })
                })
            )
        ).toThrow(/declares `capabilities.directUrl` but implements/);
    });

    it('refuses signed-url serving on a backend that cannot sign [media:I-05]', () => {
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
                            streamingPut: true,
                            publicUrls: false
                        },
                        directUrl: () => Promise.resolve('https://cdn.test/x')
                    }),
                    config: config({ directServe: 'signed-url' })
                })
            )
        ).not.toThrow();
    });

    /** A provider that publishes, declared honestly. */
    const publishing = () =>
        provider({
            capabilities: {
                directUrl: false,
                contentTypeMetadata: false,
                streamingPut: true,
                publicUrls: true
            },
            publicUrls: (key) => ({ url: `https://cdn.test/${key}` })
        });

    it('rejects a declared publicUrls capability with no publicUrls() [media:I-42]', () => {
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: provider({
                        capabilities: {
                            directUrl: false,
                            contentTypeMetadata: false,
                            streamingPut: true,
                            publicUrls: true
                        }
                    })
                })
            )
        ).toThrow(/declares `capabilities.publicUrls` but implements/);
    });

    it('refuses public URLs on a backend that publishes none, naming it [media:I-42]', () => {
        // Same reasoning as `signed-url`: reporting the app's own routes while
        // the operator believes CDN URLs are on is the failure to avoid.
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ publicUrls: 'provider' }) })
            )
        ).toThrow(
            /`publicUrls: 'provider'` needs a provider.*"local" declares `capabilities.publicUrls: false`/s
        );
    });

    it('accepts public URLs on a backend that declares them', () => {
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: publishing(),
                    config: config({
                        publicUrls: 'provider',
                        publicUrlTypes: 'all'
                    })
                })
            )
        ).not.toThrow();
    });

    it('boots a publishing backend with the switch off — the provider does not decide [media:I-41]', () => {
        expect(() =>
            MediaServerPlugin(options({ provider: publishing() }))
        ).not.toThrow();
    });

    it('rejects an unknown publicUrls or publicUrlTypes value [media:I-42]', () => {
        // Config is routinely env-derived; `'on'` or `'true'` would otherwise
        // read as "not provider" and quietly stay off.
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: publishing(),
                    config: config({
                        publicUrls: 'on' as unknown as 'provider'
                    })
                })
            )
        ).toThrow(/publicUrls must be one of 'off', 'provider' \(got "on"\)/);
        expect(() =>
            MediaServerPlugin(
                options({
                    provider: publishing(),
                    config: config({
                        publicUrls: 'provider',
                        publicUrlTypes: 'images' as unknown as 'all'
                    })
                })
            )
        ).toThrow(/publicUrlTypes must be one of 'inline-safe', 'all'/);
    });

    it('binds the resolved public-URL settings, defaulting to off and inline-safe', () => {
        const bound = (overrides: Partial<MediaPluginConfig>) => {
            const module = MediaServerPlugin(
                options({ provider: publishing(), config: config(overrides) })
            ).module as DynamicModule;
            return (module.providers ?? []).find(
                (binding): binding is ValueProvider =>
                    typeof binding === 'object' &&
                    'provide' in binding &&
                    binding.provide === PUBLIC_URLS
            )?.useValue;
        };

        expect(bound({})).toEqual({ mode: 'off', types: 'inline-safe' });
        expect(
            bound({ publicUrls: 'provider', publicUrlTypes: 'all' })
        ).toEqual({ mode: 'provider', types: 'all' });
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

    /**
     * "One object, not a list." Read off the assembled module rather than off
     * the option type, because the option type is erased: what has to hold at
     * runtime is that `STORAGE_PROVIDER` resolves to the very object the
     * composition root constructed, with nothing in between that could consult
     * a name, a config key or a default.
     */
    describe('the one storage backend', () => {
        /** Every binding of `STORAGE_PROVIDER` in the assembled module. */
        const storageBindings = (backend: StorageProvider) => {
            const module = MediaServerPlugin(options({ provider: backend }))
                .module as DynamicModule;
            return (module.providers ?? []).filter(
                (binding): binding is ValueProvider =>
                    typeof binding === 'object' &&
                    'provide' in binding &&
                    binding.provide === STORAGE_PROVIDER
            );
        };

        // covers: media:I-02
        it('is bound by identity — there is no name to look up', () => {
            const backend = provider({ id: 'local' });
            const bindings = storageBindings(backend);

            // Exactly one, and a `useValue`: a registry or a resolver would
            // have to appear here as a second binding or as a `useFactory`
            // that picks between candidates.
            expect(bindings).toHaveLength(1);
            expect(bindings[0].useValue).toBe(backend);
            expect(bindings[0]).not.toHaveProperty('useFactory');
            expect(bindings[0]).not.toHaveProperty('useClass');
        });

        // covers: media:I-02
        it('holds no default to fall back to when two are assembled', () => {
            // Two plugins in one process must not share a module-level
            // backend, and neither may substitute a built-in default: each
            // gets exactly what its own caller passed.
            const first = provider({ id: 'local' });
            const second = provider({ id: 's3' });

            expect(storageBindings(first)[0].useValue).toBe(first);
            expect(storageBindings(second)[0].useValue).toBe(second);
        });
    });
});
