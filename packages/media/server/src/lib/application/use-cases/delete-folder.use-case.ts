import { Inject, Injectable } from '@nestjs/common';
import { attachActor, OutboxWriter, UnitOfWork } from '@ortha-cms/database';
import type { PublicUser } from '@ortha-cms/identity-server';
import { FolderId } from '../../domain/value-objects/folder-id';
import { FolderNotFoundError } from '../../domain/errors/folder-not-found.error';
import { FolderNotEmptyError } from '../../domain/errors/folder-not-empty.error';
import {
    FOLDER_REPOSITORY,
    type FolderRepository
} from '../../domain/folder.repository';

/**
 * Deletes a folder — but only when empty. A folder holding child folders or
 * assets yields {@link FolderNotEmptyError} (→ 409); the library refuses to
 * cascade-destroy bytes on a single click.
 */
@Injectable()
export class DeleteFolderUseCase {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly outbox: OutboxWriter,
        @Inject(FOLDER_REPOSITORY) private readonly folders: FolderRepository
    ) {}

    /** Runs the delete. Throws when the folder is absent or non-empty. */
    async execute(
        folderId: string,
        workspaceId: string,
        actor: PublicUser
    ): Promise<void> {
        const id = FolderId.create(folderId);

        return this.uow.run(async () => {
            const folder = await this.folders.findById(id, workspaceId);
            if (!folder) {
                throw new FolderNotFoundError(folderId);
            }

            const [childFolders, assetCount] = await Promise.all([
                this.folders.countChildFolders(id, workspaceId),
                this.folders.countAssets(id, workspaceId)
            ]);
            if (childFolders > 0 || assetCount > 0) {
                throw new FolderNotEmptyError(folderId);
            }

            folder.markDeleted();
            await this.folders.delete(folder);
            await this.outbox.append(attachActor(folder.pullEvents(), actor));
        });
    }
}
