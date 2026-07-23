/**
 * TanStack Query keys for the Media Library cache, scoped per workspace so one
 * workspace's folders/assets never bleed into another's. Mutations invalidate
 * `mediaKeys.all(workspaceId)` to refresh both folders and the visible assets.
 */
export const mediaKeys = {
    all: (workspaceId: string) => ['media', workspaceId] as const,
    folders: (workspaceId: string) =>
        ['media', workspaceId, 'folders'] as const,
    assets: (workspaceId: string, folderId: string) =>
        ['media', workspaceId, 'assets', folderId] as const
};
