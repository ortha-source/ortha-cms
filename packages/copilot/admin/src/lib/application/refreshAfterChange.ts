import type { Query, QueryClient } from '@tanstack/react-query';

/** The first segment of every query key this package owns. */
const COPILOT_KEY_ROOT = 'copilot';

/**
 * Whether a cached query belongs to some **other** plugin — the page the chat
 * sits over, rather than the chat itself.
 */
export function isPageQuery(query: Pick<Query, 'queryKey'>): boolean {
    return query.queryKey[0] !== COPILOT_KEY_ROOT;
}

/**
 * Marks everything the page has cached as stale after the copilot changed
 * something, so the screen catches up without a reload.
 *
 * **Everything, not a list of keys.** A change can land in any plugin — an
 * entry, its translations, a media asset's alt text, who may read a record —
 * and this package imports none of them, so it cannot name their caches. It
 * does not have to: `invalidateQueries` refetches only what is **mounted**
 * and merely marks the rest stale for its next mount, so the cost is one
 * refetch of what is on screen. The entry editor already takes a background
 * refetch safely — a pristine form adopts the new values, one with unsaved
 * edits keeps them and says so — because a colleague's save arrives the same
 * way.
 *
 * The copilot's own queries are left out: the thread being streamed into and
 * the usage meter have their own refresh, at the end of the run.
 */
export function refreshAfterCopilotChange(queryClient: QueryClient): void {
    void queryClient.invalidateQueries({ predicate: isPageQuery });
}
