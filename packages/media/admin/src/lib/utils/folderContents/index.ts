import type { MediaFolder } from '../../types/mediaFolder';

/** What a folder holds, counted through its whole subtree. */
export type FolderContents = {
    /** Descendant folders (the folder itself excluded). */
    folders: number;
    /** Assets anywhere below, including directly inside. */
    assets: number;
};

/**
 * Counts everything a folder holds, recursively — what a delete would take with
 * it. Derived from the store's already-loaded tree (`folders` + the per-folder
 * `folderCounts` the list endpoint returns), so naming the damage in a
 * confirmation costs no extra request; it is as fresh as the last folders read,
 * which every mutation invalidates.
 */
export function folderContents(
    folders: readonly MediaFolder[],
    assetCounts: ReadonlyMap<string, number>,
    folderId: string
): FolderContents {
    const childrenOf = new Map<string, MediaFolder[]>();
    for (const folder of folders) {
        const siblings = childrenOf.get(folder.parentId) ?? [];
        siblings.push(folder);
        childrenOf.set(folder.parentId, siblings);
    }

    let descendants = 0;
    let assets = assetCounts.get(folderId) ?? 0;
    // Iterative, not recursive: a cycle in a malformed tree would otherwise
    // blow the stack, and the visited set makes that impossible.
    const seen = new Set<string>([folderId]);
    const queue = [folderId];
    while (queue.length) {
        const current = queue.pop();
        if (!current) break;
        for (const child of childrenOf.get(current) ?? []) {
            if (seen.has(child.id)) continue;
            seen.add(child.id);
            descendants += 1;
            assets += assetCounts.get(child.id) ?? 0;
            queue.push(child.id);
        }
    }
    return { folders: descendants, assets };
}
