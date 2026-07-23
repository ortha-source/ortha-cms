import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { EntryRecord } from '../../domain/types/contentType';
import {
    contentEntriesPrefix,
    contentEntryKey,
    entryRelationsPrefix,
    entryRevisionsPrefix,
    relationFieldLinksPrefix
} from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';
import type { SaveEntryInput } from '../../infrastructure/contentGateway';

export type { SaveEntryInput } from '../../infrastructure/contentGateway';

/**
 * Save mutation for one content type, over the content gateway. Create
 * (`POST /content/:type`) or update (`PATCH /content/:type/:id`) — chosen by
 * whether `id` is present; the server validates and persists the `values` bag and
 * any staged relation deltas in one transaction. A validation failure surfaces as
 * a 422 {@link ApiError} whose `details.issues` the caller maps onto the form.
 * Invalidates the type's records list on success so a created/edited row shows up.
 * Publishing is a separate step ({@link useEntryStatusActions}) so
 * create-then-publish and a standalone publish share the same validated endpoint.
 */
export function useSaveEntry(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    return useMutation<EntryRecord, ApiError, SaveEntryInput>({
        mutationFn: (input) => httpContentGateway.saveEntry(typeName, input),
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
            // Every save appends a revision — refresh the timeline so the new
            // version appears in the right-rail widget + History tab immediately.
            queryClient.invalidateQueries({
                queryKey: entryRevisionsPrefix(workspace.id, typeName)
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
