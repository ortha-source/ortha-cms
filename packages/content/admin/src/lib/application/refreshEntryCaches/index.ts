import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
    contentEntriesPrefix,
    contentEntryPrefix,
    entryRelationsPrefix,
    entryRevisionsPrefix,
    relationFieldLinksPrefix
} from '../../infrastructure/contentKeys';

/**
 * The **one** cache-refresh pass for a write to an entry, shared by every entry
 * mutation (save, publish/unpublish, delete/restore/purge, restore/publish a
 * version). Having a single definition is what lets a multi-step flow —
 * save-then-publish — run it **once at the end** instead of each mutation
 * refetching the same queries on the way past: the editor used to re-read the
 * record and its whole version timeline twice for one Publish click.
 *
 * `primedEntryId` names the record the caller has already seeded the read-one
 * cache with (the write's own response), so it is the one read-one left alone —
 * invalidating it would throw that away and re-fetch what we just received.
 * **Every other** cached record of the type is still invalidated: one save can
 * rewrite rows it didn't name, and the i18n plugin's shared-field sync does
 * exactly that (a non-localized field is written to every locale sibling). Those
 * siblings' read-ones must go, or switching locale reads the pre-save copy.
 *
 * **Awaits** every refetch, so a caller's `isPending` covers the refetching too
 * and the editor's saving overlay lifts only once the screen is up to date
 * (rather than uncovering stale values for a beat). A refetch that fails is
 * swallowed — the write itself succeeded, and failing the mutation here would
 * show the user an error for a save that landed.
 */
export async function refreshEntryCaches(
    queryClient: QueryClient,
    workspaceId: string,
    typeName: string,
    options: {
        /**
         * The record whose read-one the caller primed with the write's response.
         * It is spared; every *other* cached record of this type is invalidated,
         * since a save can rewrite siblings it didn't name.
         */
        primedEntryId?: string;
    } = {}
): Promise<void> {
    const prefixes: QueryKey[] = [
        // The records list — a created/edited/published row shows its new state.
        contentEntriesPrefix(workspaceId, typeName),
        // Every write moves the timeline: a save appends a version, a publish
        // transitions one.
        entryRevisionsPrefix(workspaceId, typeName),
        // Relation links may have changed (staged deltas persist with the save),
        // so drop the aggregate **and** the per-field infinite-scroll caches.
        entryRelationsPrefix(workspaceId, typeName),
        relationFieldLinksPrefix(workspaceId, typeName)
    ];
    try {
        await Promise.all([
            ...prefixes.map((queryKey) =>
                queryClient.invalidateQueries({ queryKey })
            ),
            // The read-ones, minus the one just primed. `contentEntryKey` is
            // `['content-entry', ws, type, id]`, so the id is at index 3.
            queryClient.invalidateQueries({
                queryKey: contentEntryPrefix(workspaceId, typeName),
                predicate: (query) =>
                    query.queryKey[3] !== options.primedEntryId
            })
        ]);
    } catch {
        // A background refetch failing must not turn a successful write into a
        // rejected mutation; the query's own error state surfaces it.
    }
}
