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

/**
 * Restore-a-revision action for one entry, over the content gateway
 * (`POST /content/:type/:id/revisions/:number/restore`). History is append-only:
 * the restore re-applies an earlier snapshot onto the live row and is itself
 * saved as a new revision, so on success this refreshes the timeline, the entry
 * read-one (Details/status), the records list, and the relation caches — the same
 * surfaces a save invalidates.
 */
export function useRevisionActions(typeName: string, id: string | undefined) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();

    const restore = useMutation<EntryRecord, ApiError, number>({
        mutationFn: (number) => {
            if (!id) {
                return Promise.reject(
                    new Error('Cannot restore a revision on an unsaved entry.')
                );
            }
            return httpContentGateway.restoreRevision(typeName, id, number);
        },
        onSuccess: async (saved) => {
            queryClient.invalidateQueries({
                queryKey: contentEntriesPrefix(workspace.id, typeName)
            });
            queryClient.invalidateQueries({
                queryKey: contentEntryKey(workspace.id, typeName, saved.id)
            });
            queryClient.invalidateQueries({
                queryKey: entryRevisionsPrefix(workspace.id, typeName)
            });
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

    return {
        /** Restore the entry to revision `number` (appends a new revision). */
        restore: restore.mutate,
        /** Whether a restore is in flight. */
        restoring: restore.isPending,
        /** The last restore error, if any (surfaced by the widget as a toast). */
        restoreError: restore.error
    };
}
