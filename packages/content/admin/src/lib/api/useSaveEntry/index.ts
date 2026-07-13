import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { EntryRecord, RelationDelta } from '../../types/contentType';
import { contentEntriesPrefix } from '../useContentEntries';
import { contentEntryKey } from '../useContentEntry';
import { entryRelationsPrefix } from '../useEntryRelations';
import { relationFieldLinksPrefix } from '../useRelationFieldLinks';

/** What a save submits: the field values, staged relation deltas, and the id. */
export type SaveEntryInput = {
    /** Present for an update; absent for a create. */
    id?: string;
    /** The field values to persist, keyed by field name. */
    values: Record<string, unknown>;
    /**
     * Staged per-field relation deltas (many/inverse relations) — the editor's
     * local link/unlink/reorder, applied with the save in one transaction. Only
     * non-empty fields are included; single relations ride in `values`.
     */
    relations?: Record<string, RelationDelta>;
};

/**
 * Create (`POST /api/content/:type`) or update (`PATCH /api/content/:type/:id`)
 * one entry — chosen by whether `id` is present. Sends the `values` bag plus any
 * staged relation `deltas`; the server validates and persists both in one
 * transaction, returning the saved {@link EntryRecord}. A validation failure
 * surfaces as a 422 {@link ApiError} whose `details.issues` the caller maps onto
 * the form.
 */
async function saveEntry(
    typeName: string,
    { id, values, relations }: SaveEntryInput
): Promise<EntryRecord> {
    const body = { values, ...(relations ? { relations } : {}) };
    try {
        const { data } = id
            ? await apiClient.patch<EntryRecord>(
                  `/content/${typeName}/${id}`,
                  body
              )
            : await apiClient.post<EntryRecord>(`/content/${typeName}`, body);
        return data;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Save mutation for one content type. Returns the TanStack mutation; callers use
 * `mutateAsync`/`isPending`. Invalidates the type's records list on success so a
 * created/edited row shows up. Publishing is a separate step ({@link
 * useEntryStatusActions}) so create-then-publish and a standalone publish share
 * the same validated endpoint.
 */
export function useSaveEntry(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation<EntryRecord, ApiError, SaveEntryInput>({
        mutationFn: (input) => saveEntry(typeName, input),
        onSuccess: async (saved) => {
            // The records list + this entry's read-one can refresh in the
            // background; nothing on screen depends on them mid-save.
            queryClient.invalidateQueries({
                queryKey: contentEntriesPrefix(workspace.id, typeName)
            });
            // Refresh this entry's read-one cache so the editor reflects the
            // server's canonical copy after an update.
            queryClient.invalidateQueries({
                queryKey: contentEntryKey(workspace.id, typeName, saved.id)
            });
            // Relation links may have changed (staged deltas persist with the
            // save), so drop the relations aggregate **and** the per-field
            // infinite-scroll caches — a re-open re-reads the canonical set.
            //
            // **Await** their refetch before the mutation resolves. The editor
            // clears its staged overlay on the same resolution; if we returned
            // before the fresh links landed, it would render the stale pre-save
            // set (kept via `keepPreviousData`) and the just-linked rows would
            // visibly flicker out until the background refetch caught up. By
            // awaiting, the overlay is only dropped once the server set already
            // contains those links, so they stay visible continuously (#7).
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: entryRelationsPrefix(workspace.id, typeName)
                }),
                queryClient.invalidateQueries({
                    queryKey: relationFieldLinksPrefix(workspace.id, typeName)
                })
            ]);
        }
    });
}
