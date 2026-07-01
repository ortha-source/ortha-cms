import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { EntryRecord } from '../../types/contentType';
import { contentEntriesPrefix } from '../useContentEntries';
import { contentEntryKey } from '../useContentEntry';
import { entryRelationsPrefix } from '../useEntryRelations';

/** What a save submits: the field values, plus the id when updating. */
export type SaveEntryInput = {
    /** Present for an update; absent for a create. */
    id?: string;
    /** The field values to persist, keyed by field name. */
    values: Record<string, unknown>;
};

/**
 * Create (`POST /api/content/:type`) or update (`PATCH /api/content/:type/:id`)
 * one entry — chosen by whether `id` is present. The server validates the values
 * and returns the saved {@link EntryRecord}; a validation failure surfaces as a
 * 422 {@link ApiError} whose `details.issues` the caller maps onto the form.
 */
async function saveEntry(
    typeName: string,
    { id, values }: SaveEntryInput
): Promise<EntryRecord> {
    try {
        const { data } = id
            ? await apiClient.patch<EntryRecord>(`/content/${typeName}/${id}`, {
                  values
              })
            : await apiClient.post<EntryRecord>(`/content/${typeName}`, {
                  values
              });
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
        onSuccess: (saved) => {
            queryClient.invalidateQueries({
                queryKey: contentEntriesPrefix(workspace.id, typeName)
            });
            // Refresh this entry's read-one cache so the editor reflects the
            // server's canonical copy after an update.
            queryClient.invalidateQueries({
                queryKey: contentEntryKey(workspace.id, typeName, saved.id)
            });
            // Relation links may have changed (assign/unassign persists with the
            // save), so drop the type's relations cache — a re-open re-reads them.
            queryClient.invalidateQueries({
                queryKey: entryRelationsPrefix(workspace.id, typeName)
            });
        }
    });
}
