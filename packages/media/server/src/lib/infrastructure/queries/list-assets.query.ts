import { Injectable } from '@nestjs/common';
import {
    and,
    asc,
    desc,
    eq,
    ilike,
    isNull,
    sql,
    type SQL
} from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { mediaAsset, mediaKind } from '../schema/media-asset';
import type { AssetListView } from '../../types/asset-view';
import { toAssetView } from './to-asset-view';

/** A valid `media_kind` enum value. */
type MediaKindColumn = (typeof mediaKind.enumValues)[number];

/** Parameters for a paginated asset listing. */
export interface ListAssetsParams {
    workspaceId: string;
    /** Folder to list, or `null` for the workspace root. */
    folderId: string | null;
    search?: string;
    kind?: string;
    sort?: string;
    page: number;
    pageSize: number;
}

/**
 * Read-side listing of a folder's assets — search over the name, an optional
 * kind filter, a whitelisted sort, and `LIMIT/OFFSET` pagination. Returns the
 * admin's `{ items, total, page, pageSize }` envelope. Bypasses the aggregate
 * (a thin CQRS query).
 */
@Injectable()
export class ListAssetsQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /** Runs the listing. */
    async execute(params: ListAssetsParams): Promise<AssetListView> {
        const conditions: SQL[] = [
            eq(mediaAsset.workspaceId, params.workspaceId),
            params.folderId
                ? eq(mediaAsset.folderId, params.folderId)
                : isNull(mediaAsset.folderId)
        ];
        if (params.kind && params.kind !== 'all') {
            conditions.push(eq(mediaAsset.kind, params.kind as MediaKindColumn));
        }
        const search = params.search?.trim();
        if (search) {
            conditions.push(ilike(mediaAsset.name, `%${search}%`));
        }
        const where = and(...conditions);
        const offset = (params.page - 1) * params.pageSize;

        const [rows, totals] = await Promise.all([
            this.db
                .select()
                .from(mediaAsset)
                .where(where)
                .orderBy(this.orderFor(params.sort), asc(mediaAsset.id))
                .limit(params.pageSize)
                .offset(offset),
            this.db
                .select({ value: sql<number>`count(*)::int` })
                .from(mediaAsset)
                .where(where)
        ]);

        return {
            items: rows.map(toAssetView),
            total: totals[0]?.value ?? 0,
            page: params.page,
            pageSize: params.pageSize
        };
    }

    private orderFor(sort: string | undefined): SQL {
        switch (sort) {
            case 'name-asc':
                return asc(mediaAsset.name);
            case 'name-desc':
                return desc(mediaAsset.name);
            case 'oldest':
                return asc(mediaAsset.createdAt);
            case 'largest':
                return desc(mediaAsset.size);
            case 'smallest':
                return asc(mediaAsset.size);
            case 'newest':
            default:
                return desc(mediaAsset.createdAt);
        }
    }
}
