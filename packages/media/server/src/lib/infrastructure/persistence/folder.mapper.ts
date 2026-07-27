import { Injectable } from '@nestjs/common';
import { Folder } from '../../domain/folder';
import type { mediaFolder } from '../schema/media-folder';

/** A `media_folder` row as selected from the database. */
export type FolderRow = typeof mediaFolder.$inferSelect;

/**
 * Translates between the persisted `media_folder` row and the {@link Folder}
 * aggregate.
 */
@Injectable()
export class FolderMapper {
    /** Rebuilds the aggregate from a row. */
    toDomain(row: FolderRow): Folder {
        return Folder.rehydrate({
            id: row.id,
            workspaceId: row.workspaceId,
            parentId: row.parentId,
            name: row.name
        });
    }

    /** The `media_folder` insert row for a brand-new aggregate. */
    toInsertRow(folder: Folder): typeof mediaFolder.$inferInsert {
        return {
            id: folder.id.value,
            workspaceId: folder.workspaceId,
            parentId: folder.parentId?.value ?? null,
            name: folder.name
        };
    }
}
