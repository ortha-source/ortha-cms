import { join } from 'node:path';
import type { ServerPlugin } from '@orthacms/bootstrap-server';
import type { StorageProvider } from '../domain/storage-provider';
import { MediaModule } from '../media.module';
import type { MediaPluginConfig } from '../types/media-config';

/** The media plugin shape, with its config attached. */
export type MediaServerPluginDefinition = ServerPlugin & {
    mediaConfig: MediaPluginConfig;
};

/** Options the host passes to {@link MediaServerPlugin}. */
export interface MediaPluginOptions {
    /**
     * The one storage backend this deployment runs, already constructed with
     * its own settings — `createLocalStorageProvider(…)`,
     * `createS3StorageProvider(…)`, or anything else implementing the port.
     *
     * One object, not a list: bytes go to a single place, so there is nothing
     * to choose between and no name to register. Swapping backend is swapping
     * this expression.
     */
    provider: StorageProvider;
    /** Host config — the upload cap. Names no backend. */
    config: MediaPluginConfig;
}

/**
 * Validate the wiring **eagerly**, the way `CopilotPlugin` validates its own
 * provider list: a broken storage seam is a misconfiguration of the composition
 * root, and the composition root is where it should be reported.
 *
 * Measured on the shipped app before this existed: pointing the media config at
 * a backend nobody had wired booted with no warning of any kind, and every
 * upload answered a bare `500 Internal server error` — a message that names
 * neither the provider nor the setting that chose it.
 */
function assertOptions(options: MediaPluginOptions): void {
    const provider = options.provider as StorageProvider | undefined;
    if (!provider) {
        throw new Error(
            'MediaServerPlugin requires a storage provider. Construct one at the composition root, ' +
                'e.g. `provider: createLocalStorageProvider(config.plugins.media.storage)`.'
        );
    }
    if (typeof provider.id !== 'string' || !provider.id.trim()) {
        throw new Error(
            "MediaServerPlugin's storage provider must expose a non-empty `id` — it is recorded on " +
                'every asset row (`media_asset.storage_provider`) and is what the boot check compares ' +
                'existing rows against.'
        );
    }
    if (!provider.capabilities) {
        throw new Error(
            `The storage provider "${provider.id}" declares no \`capabilities\`. Every provider must ` +
                'state what it supports; the core has no way to detect it.'
        );
    }
    if (provider.capabilities.directUrl && !provider.directUrl) {
        throw new Error(
            `The storage provider "${provider.id}" declares \`capabilities.directUrl\` but implements ` +
                'no `directUrl()`. Declare the capability only when the method exists.'
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
 * The storage backend is constructed at the composition root and passed in here
 * — the plugin never imports a concrete backend.
 *
 * @example
 * ```typescript
 * MediaServerPlugin({
 *   provider: createLocalStorageProvider(config.plugins.media.storage),
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
            provider: options.provider,
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
