import { DynamicModule, Module } from '@nestjs/common';
import { MEDIA_ASSET_RESOLVER } from '@ortha-cms/content-server';
import {
    STORAGE_REGISTRY,
    STORAGE_RESOLVER,
    type StorageProvider,
    type StorageResolver
} from './domain/storage-provider';
import { MediaAssetResolverQuery } from './infrastructure/queries/media-asset-resolver.query';
import { ASSET_REPOSITORY } from './domain/asset.repository';
import { FOLDER_REPOSITORY } from './domain/folder.repository';
import { IMAGE_PROCESSOR } from './domain/image-processor';
import { buildRegistry } from './infrastructure/storage-registry';
import { SharpImageProcessor } from './infrastructure/image/sharp-image-processor';
import { AssetMapper } from './infrastructure/persistence/asset.mapper';
import { FolderMapper } from './infrastructure/persistence/folder.mapper';
import { DrizzleAssetRepository } from './infrastructure/persistence/drizzle-asset.repository';
import { DrizzleFolderRepository } from './infrastructure/persistence/drizzle-folder.repository';
import { copilotToolsRegistrar } from '@ortha-cms/copilot-server';
import { ListAssetsQuery } from './infrastructure/queries/list-assets.query';
import { MediaCopilotToolProvider } from './copilot/media-tool.provider';
import { ListFoldersQuery } from './infrastructure/queries/list-folders.query';
import { AssetViewQuery } from './infrastructure/queries/asset-view.query';
import { DownloadAssetQuery } from './infrastructure/queries/download-asset.query';
import { UploadAssetUseCase } from './application/use-cases/upload-asset.use-case';
import { UpdateAssetUseCase } from './application/use-cases/update-asset.use-case';
import { DuplicateAssetUseCase } from './application/use-cases/duplicate-asset.use-case';
import { DeleteAssetsUseCase } from './application/use-cases/delete-assets.use-case';
import { CreateFolderUseCase } from './application/use-cases/create-folder.use-case';
import { RenameFolderUseCase } from './application/use-cases/rename-folder.use-case';
import { DeleteFolderUseCase } from './application/use-cases/delete-folder.use-case';
import { ListFoldersController } from './http/controllers/list-folders.controller';
import { CreateFolderController } from './http/controllers/create-folder.controller';
import { RenameFolderController } from './http/controllers/rename-folder.controller';
import { DeleteFolderController } from './http/controllers/delete-folder.controller';
import { UploadAssetController } from './http/controllers/upload-asset.controller';
import { ListAssetsController } from './http/controllers/list-assets.controller';
import { DownloadAssetController } from './http/controllers/download-asset.controller';
import { UpdateAssetController } from './http/controllers/update-asset.controller';
import { DuplicateAssetController } from './http/controllers/duplicate-asset.controller';
import { PublicMediaController } from './http/controllers/public-media.controller';
import { DeleteAssetsController } from './http/controllers/delete-assets.controller';

/** Options `MediaModule.forRoot` binds into DI. */
export interface MediaModuleOptions {
    /** Named storage providers, chosen at the composition root. */
    providers: Record<string, StorageProvider>;
    /** Optional custom handler picking a provider per upload. */
    resolve?: StorageResolver;
    /** Provider name used when no `resolve` handler is supplied. */
    defaultProvider: string;
}

/**
 * NestJS module for the media plugin — the asset/folder bounded context,
 * layered per ADR-0003 (domain / application / infrastructure / http).
 * Registered globally. Binds the storage seam (`STORAGE_REGISTRY` +
 * `STORAGE_RESOLVER`) from host-supplied providers; a missing resolver defaults
 * every upload to `defaultProvider`.
 */
@Module({})
export class MediaModule {
    /** Creates the global dynamic module: controllers, use cases, adapters. */
    static forRoot(options: MediaModuleOptions): DynamicModule {
        const resolver: StorageResolver =
            options.resolve ?? (() => options.defaultProvider);

        return {
            module: MediaModule,
            global: true,
            controllers: [
                ListFoldersController,
                CreateFolderController,
                RenameFolderController,
                DeleteFolderController,
                UploadAssetController,
                ListAssetsController,
                DownloadAssetController,
                UpdateAssetController,
                DuplicateAssetController,
                DeleteAssetsController,
                // The token-authenticated `/api/v1/media` pair (upload + raw),
                // sibling to content-server's public content API. Its own `v1`
                // prefix keeps it clear of the session routes above, so
                // registration order relative to them doesn't matter.
                PublicMediaController
            ],
            providers: [
                // Storage seam — the registry + the resolver handler.
                {
                    provide: STORAGE_REGISTRY,
                    useValue: buildRegistry(options.providers)
                },
                { provide: STORAGE_RESOLVER, useValue: resolver },
                // Image processing — probes dimensions + generates derivatives.
                { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
                // Ports → Drizzle adapters.
                { provide: ASSET_REPOSITORY, useClass: DrizzleAssetRepository },
                {
                    provide: FOLDER_REPOSITORY,
                    useClass: DrizzleFolderRepository
                },
                AssetMapper,
                FolderMapper,
                // Application use cases.
                UploadAssetUseCase,
                UpdateAssetUseCase,
                DuplicateAssetUseCase,
                DeleteAssetsUseCase,
                CreateFolderUseCase,
                RenameFolderUseCase,
                DeleteFolderUseCase,
                // Read models.
                ListAssetsQuery,
                ListFoldersQuery,
                // The copilot's read-only asset search. Both no-op when no
                // copilot plugin is registered — the registrar injects the
                // registry optionally.
                MediaCopilotToolProvider,
                copilotToolsRegistrar('media', MediaCopilotToolProvider),
                AssetViewQuery,
                DownloadAssetQuery,
                // Binds content-server's media-asset resolver port, so a content
                // record's media field can be checked for existence + `accept`
                // against real assets. Global module, so content-server's
                // EntryWriterService (also global) resolves it.
                MediaAssetResolverQuery,
                {
                    provide: MEDIA_ASSET_RESOLVER,
                    useExisting: MediaAssetResolverQuery
                }
            ],
            exports: [MEDIA_ASSET_RESOLVER]
        };
    }
}
