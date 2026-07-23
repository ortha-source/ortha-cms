import { Injectable } from '@nestjs/common';
import { and, count, eq } from 'drizzle-orm';
import { UnitOfWork } from '@ortha-cms/database';
import { Folder } from '../../domain/folder';
import type { FolderId } from '../../domain/value-objects/folder-id';
import type { FolderRepository } from '../../domain/folder.repository';
import { mediaAsset } from '../schema/media-asset';
import { mediaFolder } from '../schema/media-folder';
import { FolderMapper } from './folder.mapper';

/**
 * Drizzle-backed {@link FolderRepository}. Runs through {@link UnitOfWork} so
 * writes join the ambient transaction; the count helpers back the delete
 * use-case's emptiness guard.
 */
@Injectable()
export class DrizzleFolderRepository implements FolderRepository {
    constructor(
        private readonly uow: UnitOfWork,
        private readonly mapper: FolderMapper
    ) {}

    /** {@inheritDoc FolderRepository.findById} */
    async findById(id: FolderId, workspaceId: string): Promise<Folder | null> {
        const [row] = await this.uow
            .current()
            .select()
            .from(mediaFolder)
            .where(
                and(
                    eq(mediaFolder.id, id.value),
                    eq(mediaFolder.workspaceId, workspaceId)
                )
            )
            .limit(1);
        return row ? this.mapper.toDomain(row) : null;
    }

    /** {@inheritDoc FolderRepository.exists} */
    async exists(id: FolderId, workspaceId: string): Promise<boolean> {
        const [row] = await this.uow
            .current()
            .select({ id: mediaFolder.id })
            .from(mediaFolder)
            .where(
                and(
                    eq(mediaFolder.id, id.value),
                    eq(mediaFolder.workspaceId, workspaceId)
                )
            )
            .limit(1);
        return !!row;
    }

    /** {@inheritDoc FolderRepository.save} */
    async save(folder: Folder): Promise<void> {
        const executor = this.uow.current();
        if (folder.isNew) {
            await executor
                .insert(mediaFolder)
                .values(this.mapper.toInsertRow(folder));
            return;
        }
        await executor
            .update(mediaFolder)
            .set({ name: folder.name })
            .where(
                and(
                    eq(mediaFolder.id, folder.id.value),
                    eq(mediaFolder.workspaceId, folder.workspaceId)
                )
            );
    }

    /** {@inheritDoc FolderRepository.delete} */
    async delete(folder: Folder): Promise<void> {
        await this.uow
            .current()
            .delete(mediaFolder)
            .where(
                and(
                    eq(mediaFolder.id, folder.id.value),
                    eq(mediaFolder.workspaceId, folder.workspaceId)
                )
            );
    }

    /** {@inheritDoc FolderRepository.countChildFolders} */
    async countChildFolders(
        id: FolderId,
        workspaceId: string
    ): Promise<number> {
        const [row] = await this.uow
            .current()
            .select({ value: count() })
            .from(mediaFolder)
            .where(
                and(
                    eq(mediaFolder.parentId, id.value),
                    eq(mediaFolder.workspaceId, workspaceId)
                )
            );
        return row?.value ?? 0;
    }

    /** {@inheritDoc FolderRepository.countAssets} */
    async countAssets(id: FolderId, workspaceId: string): Promise<number> {
        const [row] = await this.uow
            .current()
            .select({ value: count() })
            .from(mediaAsset)
            .where(
                and(
                    eq(mediaAsset.folderId, id.value),
                    eq(mediaAsset.workspaceId, workspaceId)
                )
            );
        return row?.value ?? 0;
    }
}
