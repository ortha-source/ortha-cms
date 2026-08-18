import type { ListAssetsParams } from '../mediaGateway';

/**
 * The part of a listing that decides which assets come back. Everything the
 * server filters, orders or pages by is in the key, so changing a control
 * fetches its own page instead of re-reading one built under the previous
 * controls. `folderId` stays a separate segment: it is the thing the user
 * navigates, and keeping it above the rest makes a folder's pages
 * invalidatable on their own.
 */
type AssetListKey = Omit<ListAssetsParams, 'folderId'>;

/**
 * TanStack Query keys for the Media Library cache, scoped per workspace so one
 * workspace's folders/assets never bleed into another's. Mutations invalidate
 * `mediaKeys.all(workspaceId)`, which is a prefix of every key below, so it
 * still refreshes the folders and whichever asset page is on screen.
 */
export const mediaKeys = {
    all: (workspaceId: string) => ['media', workspaceId] as const,
    folders: (workspaceId: string) =>
        ['media', workspaceId, 'folders'] as const,
    assets: (workspaceId: string, folderId: string, list: AssetListKey) =>
        ['media', workspaceId, 'assets', folderId, list] as const
};
