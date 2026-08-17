import { join } from 'node:path';
import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type {
    StorageProvider,
    StorageResolver
} from '../domain/storage-provider';
import { MediaModule } from '../media.module';
import type { MediaPluginConfig } from '../types/media-config';

/** The media plugin shape, with its config attached. */
export type MediaServerPluginDefinition = ServerPlugin & {
    mediaConfig: MediaPluginConfig;
};

/** Options the host passes to {@link MediaServerPlugin}. */
export interface MediaPluginOptions {
    /** Named storage providers available to this deployment. */
    providers: Record<string, StorageProvider>;
    /** Optional custom handler picking a provider per upload (plain code). */
    resolve?: StorageResolver;
    /** Host config (connection settings + default provider + upload cap). */
    config: MediaPluginConfig;
}

/**
 * Validate the wiring **eagerly**, the way `CopilotPlugin` validates its own
 * provider list: a `defaultProvider` naming a provider nobody registered is a
 * misconfiguration of the composition root, and the composition root is where it
 * should be reported.
 *
 * Measured on the shipped app before this existed: `MEDIA_PROVIDER=s3` (the
 * bucket keys exist in config, but no S3 adapter is registered) booted with no
 * warning of any kind, and every upload answered a bare
 * `500 Internal server error` — a message that names neither the provider nor
 * the variable that chose it. One typo, and the media library is broken in a way
 * whose cause is invisible from the outside.
 */
function assertOptions(options: MediaPluginOptions): void {
    const names = Object.keys(options.providers);
    if (names.length === 0) {
        throw new Error(
            'MediaServerPlugin requires at least one storage provider. Register one at the ' +
                "composition root, e.g. `providers: { local: createLocalStorageProvider(…) }`."
        );
    }
    const { defaultProvider } = options.config;
    if (!defaultProvider) {
        throw new Error(
            'MediaServerPlugin requires `config.defaultProvider` to name one of the registered ' +
                `providers. Registered: ${names.join(', ')}.`
        );
    }
    if (!names.includes(defaultProvider)) {
        throw new Error(
            `MediaServerPlugin's defaultProvider "${defaultProvider}" is not registered. ` +
                `Registered: ${names.join(', ')}.`
        );
    }
    if (
        !Number.isFinite(options.config.maxUploadBytes) ||
        options.config.maxUploadBytes <= 0
    ) {
        throw new Error(
            "MediaServerPlugin's maxUploadBytes must be a positive number (got " +
                `${options.config.maxUploadBytes}) — a non-positive cap rejects every upload.`
        );
    }
}

/**
 * Creates the media plugin. Register it **after** `WorkspacesPlugin` (its routes
 * use `WorkspaceGuard`) and `IdentityPlugin` (its routes use `PermissionsGuard`).
 * The chosen storage provider(s) are constructed at the composition root and
 * passed in here — the plugin never imports a concrete backend.
 *
 * @example
 * ```typescript
 * MediaServerPlugin({
 *   providers: { local: createLocalStorageProvider(config.plugins.media.local) },
 *   config: config.plugins.media
 * });
 * ```
 */
export function MediaServerPlugin(
    options: MediaPluginOptions
): MediaServerPluginDefinition {
    assertOptions(options);
    return {
        name: 'media',
        module: MediaModule.forRoot({
            providers: options.providers,
            resolve: options.resolve,
            defaultProvider: options.config.defaultProvider,
            maxUploadBytes: options.config.maxUploadBytes
        }),
        mediaConfig: options.config,
        migrations: {
            // Lazy — only called at migrate time. Source layout: src/lib/utils
            // → ../../../migrations = <pkg>/migrations.
            dir: () => join(__dirname, '../../../migrations'),
            table: '__drizzle_migrations_media'
        }
    };
}
