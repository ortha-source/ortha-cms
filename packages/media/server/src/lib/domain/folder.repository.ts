import type { Folder } from './folder';
import type { FolderId } from './value-objects/folder-id';

/**
 * The persistence **port** for the {@link Folder} aggregate. Application code
 * depends on this interface; the infrastructure layer binds a Drizzle adapter
 * to {@link FOLDER_REPOSITORY}. Every lookup is workspace-scoped.
 */
export interface FolderRepository {
    /** Loads one folder within `workspaceId`, or `null` when absent. */
    findById(id: FolderId, workspaceId: string): Promise<Folder | null>;
    /**
     * Loads one folder `FOR UPDATE` — an exclusive row lock the delete
     * use-case takes before its emptiness check. It conflicts with the
     * `FOR SHARE` lock {@link existsForShare} takes, so a delete and a
     * concurrent insert-of-a-child serialize on this row instead of racing
     * into an orphaned reference (there is no FK to catch one).
     */
    findByIdForUpdate(id: FolderId, workspaceId: string): Promise<Folder | null>;
    /**
     * Whether a folder with `id` exists within `workspaceId`, taking a
     * `FOR SHARE` lock on the row. Every write that attaches a child to this
     * folder (upload / move / create-subfolder) calls this inside its
     * transaction, so a concurrent {@link findByIdForUpdate} in the delete
     * use-case blocks until the child commits — and then sees it.
     */
    existsForShare(id: FolderId, workspaceId: string): Promise<boolean>;
    /** Inserts a new folder or applies a loaded folder's edits. */
    save(folder: Folder): Promise<void>;
    /** Removes the folder row. */
    delete(folder: Folder): Promise<void>;
    /** How many folders have `id` as their parent (emptiness check). */
    countChildFolders(id: FolderId, workspaceId: string): Promise<number>;
    /** How many assets live directly in `id` (emptiness check). */
    countAssets(id: FolderId, workspaceId: string): Promise<number>;
}

/**
 * DI token the infrastructure adapter binds to a {@link FolderRepository}. A
 * plain `Symbol`, so the domain declares it without importing `@nestjs/*`.
 */
export const FOLDER_REPOSITORY = Symbol('FOLDER_REPOSITORY');
