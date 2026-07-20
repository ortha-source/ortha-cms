import { Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { mediaAsset } from '../schema/media-asset';
import { mediaFolder } from '../schema/media-folder';
import type { FolderView } from '../../types/folder-view';

/** Lists a workspace's folders, each with its direct asset count. */
@Injectable()
export class ListFoldersQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** Returns every folder in `workspaceId`, name-sorted. */
    async execute(workspaceId: string): Promise<FolderView[]> {
        const [folders, counts] = await Promise.all([
            this.db
                .select()
                .from(mediaFolder)
                .where(eq(mediaFolder.workspaceId, workspaceId))
                .orderBy(asc(mediaFolder.name)),
            this.db
                .select({
                    folderId: mediaAsset.folderId,
                    value: sql<number>`count(*)::int`
                })
                .from(mediaAsset)
                .where(eq(mediaAsset.workspaceId, workspaceId))
                .groupBy(mediaAsset.folderId)
        ]);

        const countByFolder = new Map(
            counts
                .filter((row) => row.folderId !== null)
                .map((row) => [row.folderId as string, row.value])
        );

        return folders.map((folder) => ({
            id: folder.id,
            name: folder.name,
            parentId: folder.parentId,
            assetCount: countByFolder.get(folder.id) ?? 0,
            createdAt: folder.createdAt.toISOString()
        }));
    }
}
