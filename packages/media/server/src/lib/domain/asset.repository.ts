import type { Asset } from './asset';
import type { AssetId } from './value-objects/asset-id';
import type { FolderId } from './value-objects/folder-id';

/**
 * The persistence **port** for the {@link Asset} aggregate. Application code
 * depends on this interface; the infrastructure layer binds a Drizzle adapter
 * to {@link ASSET_REPOSITORY}. Every lookup is workspace-scoped so an id from
 * another workspace reads as absent.
 */
export interface AssetRepository {
    /** Loads one asset within `workspaceId`, or `null` when absent. */
    findById(id: AssetId, workspaceId: string): Promise<Asset | null>;
    /** Loads the assets among `ids` that exist within `workspaceId`. */
    findManyByIds(ids: AssetId[], workspaceId: string): Promise<Asset[]>;
    /**
     * Loads every asset living directly in any of `folderIds` — what a folder
     * cascade deletes. Root assets (`folder_id is null`) are never included:
     * the root isn't a folder anyone can delete.
     */
    findManyByFolderIds(
        folderIds: FolderId[],
        workspaceId: string
    ): Promise<Asset[]>;
    /** Inserts a new aggregate or applies a loaded aggregate's edits. */
    save(asset: Asset): Promise<void>;
    /** Removes the asset row (the blob is reclaimed post-commit). */
    delete(asset: Asset): Promise<void>;
}

/**
 * DI token the infrastructure adapter binds to an {@link AssetRepository}. A
 * plain `Symbol`, so the domain declares it without importing `@nestjs/*`.
 */
export const ASSET_REPOSITORY = Symbol('ASSET_REPOSITORY');
