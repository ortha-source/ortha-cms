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

/** Every create form's answer in one workspace — what a rule write refreshes. */
export const newEntryProtectionPrefix = (workspaceId: string) =>
    ['protection', 'new-entry', workspaceId] as const;

/** What a new entry of one type would meet — the create form's read. */
export const newEntryProtectionKey = (workspaceId: string, typeName: string) =>
    [...newEntryProtectionPrefix(workspaceId), typeName] as const;

/**
 * Every rule the workspace holds.
 *
 * Carries the workspace id for the reason above: the list is scoped by the
 * ambient `X-Workspace-Id` header, which is not sent on a cache hit.
 */
export const rulesKey = (workspaceId: string) =>
    ['protection', 'rules', workspaceId] as const;

/**
 * One page of the reviewer queue.
 *
 * The window is part of the key so paging does not serve the previous page's
 * rows; the workspace id is there for the reason every key here carries it.
 */
export const queueKey = (
    workspaceId: string,
    window: { limit?: number; offset?: number } = {}
) =>
    [
        'protection',
        'queue',
        workspaceId,
        window.limit ?? null,
        window.offset ?? null
    ] as const;

/**
 * One records page's review statuses.
 *
 * The **entry ids** are part of the key, not just the type: paging or filtering
 * the list changes which rows are on screen, and a key that ignored them would
 * serve the previous page's numbers against the new page's rows — wrong in a way
 * that looks plausible. Sorted so two renders of the same page share one entry.
 */
export const reviewStatusKey = (
    workspaceId: string,
    typeName: string,
    entryIds: readonly string[]
) =>
    [
        'protection',
        'review-status',
        workspaceId,
        typeName,
        [...entryIds].sort().join(',')
    ] as const;

/** The Insights card's figures. */
export const insightsKey = (workspaceId: string) =>
    ['protection', 'insights', workspaceId] as const;
