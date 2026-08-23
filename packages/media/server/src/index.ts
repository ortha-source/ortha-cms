export { MediaServerPlugin } from './lib/utils/media-plugin';
export type {
    MediaServerPluginDefinition,
    MediaPluginOptions
} from './lib/utils/media-plugin';
export { MediaModule } from './lib/media.module';
export type { MediaModuleOptions } from './lib/media.module';
export type {
    MediaPluginConfig,
    MediaLocalConfig,
    MediaS3Config
} from './lib/types/media-config';
export type {
    StorageProvider,
    StoredObject,
    PutObject,
    UploadContext,
    StorageRegistry,
    StorageResolver
} from './lib/domain/storage-provider';
export {
    STORAGE_REGISTRY,
    STORAGE_RESOLVER
} from './lib/domain/storage-provider';
// Exported for the provider packages: `get` promises to reject when the key is
// gone, and the *kind* of rejection is part of that promise rather than an
// implementation detail of a filesystem or a bucket.
export { ObjectNotFoundError } from './lib/domain/errors/object-not-found.error';
export type { AssetView, AssetListView } from './lib/types/asset-view';
export type { FolderView, FoldersView } from './lib/types/folder-view';
export * from './lib/infrastructure/schema';
