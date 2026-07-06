import { useQuery } from '@tanstack/react-query';
import { loadRecordDraft } from '../../utils/recordFixtures';
import type { RecordDraft, RecordValues } from '../../types/recordDraft';

/** Query key for a record draft, scoped by collection + id + locale. */
export function recordDraftKey(
    collection: string,
    recordId: string,
    locale: string
): readonly unknown[] {
    return ['record-draft', collection, recordId, locale] as const;
}

/**
 * Loads a record draft for the editor. Backed by {@link loadRecordDraft} (a
 * fixture) today; the query shape is the real one, so pointing it at the content
 * API later is a change to the `queryFn` alone. Keyed by locale so switching the
 * edited translation refetches the matching values.
 */
export function useRecordDraft(
    collection: string,
    recordId: string,
    locale: string
) {
    return useQuery<RecordDraft>({
        queryKey: recordDraftKey(collection, recordId, locale),
        queryFn: () => loadRecordDraft(collection, recordId, locale),
        // A design fixture never goes stale under the user; keep it put so the
        // editor's local edits aren't clobbered by a background refetch.
        staleTime: Infinity,
        gcTime: Infinity
    });
}

/** The write payload an autosave sends. */
export interface SaveRecordInput {
    id: string;
    collection: string;
    locale: string;
    values: RecordValues;
    /** The publish intent riding with this save. */
    publish?: boolean;
}

/**
 * Mock persistence for an autosave / publish. Resolves after a short, visible
 * latency so the top-bar indicator can cycle "Saving…" → "Saved". Returns the
 * server-authoritative `updatedAt` the editor stamps into the Details widget.
 */
export async function saveRecordDraft(
    _input: SaveRecordInput
): Promise<{ updatedAt: string }> {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return { updatedAt: new Date().toISOString() };
}
