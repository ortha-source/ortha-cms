import type { StorageProvider } from '../domain/storage-provider';
import type { MediaPluginConfig } from '../types/media-config';
import { MediaServerPlugin, type MediaPluginOptions } from './media-plugin';

const provider = (): StorageProvider => ({
    put: () => Promise.reject(new Error('not called')),
    get: () => Promise.reject(new Error('not called')),
    remove: () => Promise.resolve(),
    url: () => Promise.resolve('/not-called')
});

const config = (
    overrides: Partial<MediaPluginConfig> = {}
): MediaPluginConfig => ({
    defaultProvider: 'local',
    local: { rootDir: './.storage/media', publicBasePath: '/api/media/assets' },
    s3: { bucket: '', region: '' },
    maxUploadBytes: 52_428_800,
    ...overrides
});

const options = (
    overrides: Partial<MediaPluginOptions> = {}
): MediaPluginOptions => ({
    providers: { local: provider() },
    config: config(),
    ...overrides
});

/**
 * The plugin validates its wiring eagerly, like `CopilotPlugin` does — because
 * the alternative is a per-request failure whose cause is nowhere in the message.
 *
 * The case that prompted these: `MEDIA_PROVIDER=s3` on the shipped app. The
 * config type has `s3` connection settings, so it looks like a supported value,
 * but `apps/server/src/plugins.ts` registers only `local`. The server booted
 * silently and every upload answered a bare `500 Internal server error`.
 */
describe('MediaServerPlugin()', () => {
    it('constructs with a default provider that is registered', () => {
        expect(MediaServerPlugin(options()).name).toBe('media');
    });

    it('rejects a defaultProvider nobody registered, listing the ones that exist', () => {
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ defaultProvider: 's3' }) })
            )
        ).toThrow(/defaultProvider "s3" is not registered.*Registered: local/s);
    });

    it('rejects an empty defaultProvider', () => {
        expect(() =>
            MediaServerPlugin(
                options({ config: config({ defaultProvider: '' }) })
            )
        ).toThrow(/defaultProvider/);
    });

    it('rejects an empty provider map', () => {
        expect(() => MediaServerPlugin(options({ providers: {} }))).toThrow(
            /at least one storage provider/
        );
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
