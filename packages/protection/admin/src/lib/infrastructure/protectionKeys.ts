/**
 * Query keys for the protection cache.
 *
 * Every key carries the **workspace id**, because the review read is scoped by
 * `apiClient`'s ambient `X-Workspace-Id` header and that header is not sent on
 * a cache hit — without the id in the key, switching workspaces would serve one
 * workspace's answer for another's entry.
 */

/** Root of everything this plugin caches. */
export const protectionPrefix = ['protection'] as const;

/** One entry's review state. */
export const entryReviewKey = (
    workspaceId: string,
    typeName: string,
    entryId: string
) => ['protection', 'entry-review', workspaceId, typeName, entryId] as const;

/**
 * Every rule the workspace holds.
 *
 * Carries the workspace id for the reason above: the list is scoped by the
 * ambient `X-Workspace-Id` header, which is not sent on a cache hit.
 */
export const rulesKey = (workspaceId: string) =>
    ['protection', 'rules', workspaceId] as const;
