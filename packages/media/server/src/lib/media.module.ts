import { DynamicModule, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { MEDIA_ASSET_RESOLVER } from '@orthacms/content-server';
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
import { copilotAppliersRegistrar } from '@orthacms/copilot-server';
import { COPILOT_ATTACHMENT_RESOLVER } from '@orthacms/copilot-domain';
import { ListAssetsQuery } from './infrastructure/queries/list-assets.query';
import { MediaInsightsQuery } from './infrastructure/queries/media-insights.query';
import { MediaInsightsController } from './http/controllers/media-insights.controller';
import { MediaCopilotToolProvider } from './copilot/media-tool.provider';
import { AltTextProposalToolProvider } from './copilot/alt-text-proposal.provider';
import { AltTextProposalApplier } from './copilot/alt-text-proposal.applier';
import { CreateFileProposalToolProvider } from './copilot/create-file-proposal.provider';
import { CreateFileProposalApplier } from './copilot/create-file-proposal.applier';
import { AttachmentResolverQuery } from './copilot/attachment-resolver.query';
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
import { MediaWorkspacePurger } from './infrastructure/purge/media-workspace.purger';
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
    /**
     * Hard ceiling on a single upload, in bytes — the host's
     * `config.plugins.media.maxUploadBytes`. Bounds the memory multer buffers
     * per request (it stops reading past the cap and errors), so an oversized
     * POST cannot exhaust the heap.
     */
    maxUploadBytes: number;
}

/**
 * Translates the plugin's **inclusive** cap into multer's limit.
 *
 * busboy raises `LIMIT_FILE_SIZE` the moment the file reaches `limits.fileSize`
 * (`fileSize === fileSizeLimit`, not `>`), so passing the cap verbatim rejects a
 * file of *exactly* the documented maximum. One more byte of headroom makes
 * "maximum upload size" mean what it says: `maxUploadBytes` is accepted,
 * `maxUploadBytes + 1` is a 413.
 */
function multerFileSizeFor(maxUploadBytes: number): number {
    return maxUploadBytes + 1;
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
            imports: [
                // The upload cap, from config. `FileInterceptor('file')` takes
                // no local options in either upload controller, so it injects
                // these `MULTER_MODULE_OPTIONS` instead — which is what lets
                // `maxUploadBytes` be host config rather than a module-level
                // `process.env` read the host could not override.
                MulterModule.register({
                    limits: {
                        fileSize: multerFileSizeFor(options.maxUploadBytes)
                    }
                })
            ],
            controllers: [
                // Insights read-model. Its `insights` first segment can't
                // collide with the `media/...` routes below.
                MediaInsightsController,
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
                // Removes this workspace's assets, folders and blobs when the
                // workspace itself is deleted — registers itself with the
                // workspaces plugin's purge registry (media's rows carry no FK
                // to `workspaces`, so nothing else would reach them).
                MediaWorkspacePurger,
                // Read models.
                ListAssetsQuery,
                MediaInsightsQuery,
                ListFoldersQuery,
                // The copilot's read tools — asset search, folder listing and
                // reading a text asset. All no-op when no copilot plugin is
                // registered: they inject the registry optionally.
                MediaCopilotToolProvider,
                AltTextProposalToolProvider,
                CreateFileProposalToolProvider,
                // The appliers for the kinds those propose tools produce. Next
                // to them on purpose: a missing applier surfaces only when a
                // human approves the change it was meant to carry out.
                AltTextProposalApplier,
                CreateFileProposalApplier,
                copilotAppliersRegistrar(
                    'media',
                    AltTextProposalApplier,
                    CreateFileProposalApplier
                ),
                // Binds the copilot's attachment port, so a run can be told
                // what the files someone attached to a message are. A plain
                // binding rather than a runtime registration: there is one
                // media library, so unlike the appliers there is nothing to
                // merge across dynamic modules.
                AttachmentResolverQuery,
                {
                    provide: COPILOT_ATTACHMENT_RESOLVER,
                    useExisting: AttachmentResolverQuery
                },
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
            exports: [MEDIA_ASSET_RESOLVER, COPILOT_ATTACHMENT_RESOLVER]
        };
    }
}
