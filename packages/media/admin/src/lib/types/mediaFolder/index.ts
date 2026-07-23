/**
 * A folder grouping assets in the library. Folders form a tree via `parentId`;
 * the top level is the synthetic root (`ROOT_FOLDER_ID`), which has no folder
 * record of its own. This is the admin's model, mirrored from the future API.
 */
export type MediaFolder = {
    /** Stable unique id. */
    id: string;
    /** Folder name shown to the user. */
    name: string;
    /** Parent folder id (`ROOT_FOLDER_ID` for a top-level folder). */
    parentId: string;
    /** ISO timestamp the folder was created. */
    createdAt: string;
};
