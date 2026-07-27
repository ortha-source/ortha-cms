import { ROOT_FOLDER_ID } from '../../constants';
import type { MediaFolder } from '../../types/mediaFolder';

/** A folder paired with its depth below the root, for indented rendering. */
export type FolderTreeNode = {
    folder: MediaFolder;
    depth: number;
};

/**
 * Flattens the folder forest into a depth-first, name-sorted list annotated with
 * each folder's depth below the root. Shared by the folders nav tree and the
 * move-to-folder picker so both render the same ordering and indentation.
 */
export function flattenFolderTree(
    folders: MediaFolder[],
    parentId: string = ROOT_FOLDER_ID,
    depth = 0
): FolderTreeNode[] {
    return folders
        .filter((folder) => folder.parentId === parentId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .flatMap((folder) => [
            { folder, depth },
            ...flattenFolderTree(folders, folder.id, depth + 1)
        ]);
}
