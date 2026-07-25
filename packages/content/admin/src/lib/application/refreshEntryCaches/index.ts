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
 * `skipEntry` is passed by the writes that return the canonical record: the
 * caller has already seeded the read-one cache with the response, so
 * invalidating it here would throw that away and re-fetch what we just received.
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
        /** Leave the read-one cache alone — the caller primed it with the response. */
        skipEntry?: boolean;
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
    if (!options.skipEntry) {
        prefixes.push(contentEntryPrefix(workspaceId, typeName));
    }
    try {
        await Promise.all(
            prefixes.map((queryKey) =>
                queryClient.invalidateQueries({ queryKey })
            )
        );
    } catch {
        // A background refetch failing must not turn a successful write into a
        // rejected mutation; the query's own error state surfaces it.
    }
}
