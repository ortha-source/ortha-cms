import { DynamicModule, Module } from '@nestjs/common';
import {
    STORAGE_REGISTRY,
    STORAGE_RESOLVER,
    type StorageProvider,
    type StorageResolver
} from './domain/storage-provider';
import { ASSET_REPOSITORY } from './domain/asset.repository';
import { FOLDER_REPOSITORY } from './domain/folder.repository';
import { buildRegistry } from './infrastructure/storage-registry';
import { AssetMapper } from './infrastructure/persistence/asset.mapper';
import { FolderMapper } from './infrastructure/persistence/folder.mapper';
import { DrizzleAssetRepository } from './infrastructure/persistence/drizzle-asset.repository';
import { DrizzleFolderRepository } from './infrastructure/persistence/drizzle-folder.repository';
import { ListAssetsQuery } from './infrastructure/queries/list-assets.query';
import { ListFoldersQuery } from './infrastructure/queries/list-folders.query';
import { AssetViewQuery } from './infrastructure/queries/asset-view.query';
import { DownloadAssetQuery } from './infrastructure/queries/download-asset.query';
import { UploadAssetUseCase } from './application/use-cases/upload-asset.use-case';
import { UpdateAssetUseCase } from './application/use-cases/update-asset.use-case';
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
                DeleteAssetsController
            ],
            providers: [
                // Storage seam — the registry + the resolver handler.
                {
                    provide: STORAGE_REGISTRY,
                    useValue: buildRegistry(options.providers)
                },
                { provide: STORAGE_RESOLVER, useValue: resolver },
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
                DeleteAssetsUseCase,
                CreateFolderUseCase,
                RenameFolderUseCase,
                DeleteFolderUseCase,
                // Read models.
                ListAssetsQuery,
                ListFoldersQuery,
                AssetViewQuery,
                DownloadAssetQuery
            ]
        };
    }
}
