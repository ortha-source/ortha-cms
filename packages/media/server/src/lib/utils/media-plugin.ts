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
    return {
        name: 'media',
        module: MediaModule.forRoot({
            providers: options.providers,
            resolve: options.resolve,
            defaultProvider: options.config.defaultProvider
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
