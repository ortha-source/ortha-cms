import { Inject, Injectable } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { attachActor, OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import type { PublicUser } from '@ortha-cms/identity-server';
import { Asset } from '../../domain/asset';
import { AssetId } from '../../domain/value-objects/asset-id';
import { FolderId } from '../../domain/value-objects/folder-id';
import { FileName } from '../../domain/value-objects/file-name';
import { MediaKind } from '../../domain/value-objects/media-kind';
import { StorageKey } from '../../domain/value-objects/storage-key';
import { FolderNotFoundError } from '../../domain/errors/folder-not-found.error';
import {
    ASSET_REPOSITORY,
    type AssetRepository
} from '../../domain/asset.repository';
import {
    FOLDER_REPOSITORY,
    type FolderRepository
} from '../../domain/folder.repository';
import {
    STORAGE_REGISTRY,
    STORAGE_RESOLVER,
    type StorageRegistry,
    type StorageResolver
} from '../../domain/storage-provider';

/** Inputs for one upload — the file stream plus its metadata. */
export interface UploadAssetCommand {
    workspaceId: string;
    /** Destination folder id, or `null`/absent for the workspace root. */
    folderId: string | null;
    fileName: string;
    contentType: string;
    size: number;
    body: Readable;
}

/**
 * Uploads one asset: the resolver picks a backend, the bytes stream to it, then
 * the row + audit event commit atomically. The provider name is recorded on the
 * asset so downloads/deletes route to the same backend.
 */
@Injectable()
export class UploadAssetUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(STORAGE_REGISTRY) private readonly registry: StorageRegistry,
        @Inject(STORAGE_RESOLVER) private readonly resolve: StorageResolver,
        @Inject(ASSET_REPOSITORY) private readonly assets: AssetRepository,
        @Inject(FOLDER_REPOSITORY) private readonly folders: FolderRepository
    ) {}

    /** Runs the upload. Returns the new asset id. */
    async execute(
        command: UploadAssetCommand,
        actor: PublicUser
    ): Promise<string> {
        const folderId = command.folderId
            ? FolderId.create(command.folderId)
            : null;
        const fileName = FileName.create(command.fileName);
        const kind = MediaKind.fromMime(command.contentType);
        const assetId = AssetId.generate();

        const providerName = this.resolve(
            {
                workspaceId: command.workspaceId,
                folderId: command.folderId,
                fileName: fileName.value,
                contentType: command.contentType,
                kind: kind.value,
                size: command.size
            },
            this.registry
        );
        const provider = this.registry.get(providerName);
        const stored = await provider.put({
            workspaceId: command.workspaceId,
            assetId: assetId.value,
            fileName: fileName.value,
            contentType: command.contentType,
            body: command.body
        });

        try {
            return await this.uow.run(async () => {
                if (
                    folderId &&
                    !(await this.folders.exists(folderId, command.workspaceId))
                ) {
                    throw new FolderNotFoundError(folderId.value);
                }
                const asset = Asset.create({
                    id: assetId,
                    workspaceId: command.workspaceId,
                    folderId,
                    name: fileName,
                    storageKey: StorageKey.create(stored.storageKey),
                    storageProvider: providerName,
                    kind,
                    mimeType: command.contentType,
                    size: stored.size,
                    checksum: stored.checksum,
                    uploadedBy: actor.id
                });
                await this.assets.save(asset);
                await this.outbox.append(
                    attachActor(asset.pullEvents(), actor)
                );
                return asset.id.value;
            });
        } catch (error) {
            // The transaction rolled back after the blob was written — reclaim
            // the orphan so a failed upload leaves nothing behind.
            await provider.remove(stored.storageKey).catch(() => undefined);
            throw error;
        }
    }
}
