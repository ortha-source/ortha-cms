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
 * Revision actions for one entry, over the content gateway — **restore** and
 * **publish a specific version**. Both are append-only and mutate the same
 * surfaces a save does, so each invalidates the timeline, the entry read-one
 * (Details/status), the records list, and the relation caches.
 *
 * - `restore` (`POST …/revisions/:number/restore`) re-applies an earlier snapshot
 *   onto the live row as a **new draft** revision.
 * - `publish` (`POST …/revisions/:number/publish`) makes a chosen version live:
 *   the newest publishes in place, an earlier one is restored then published, so
 *   its content becomes the live/published version (the prior one superseded).
 *   Can reject with a 422 when the version fails the publish gate.
 */
export function useRevisionActions(typeName: string, id: string | undefined) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();

    const invalidate = async (savedId: string) => {
        queryClient.invalidateQueries({
            queryKey: contentEntriesPrefix(workspace.id, typeName)
        });
        queryClient.invalidateQueries({
            queryKey: contentEntryKey(workspace.id, typeName, savedId)
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
    };

    const restore = useMutation<EntryRecord, ApiError, number>({
        mutationFn: (number) => {
            if (!id) {
                return Promise.reject(
                    new Error('Cannot restore a revision on an unsaved entry.')
                );
            }
            return httpContentGateway.restoreRevision(typeName, id, number);
        },
        onSuccess: (saved) => invalidate(saved.id)
    });

    const publish = useMutation<EntryRecord, ApiError, number>({
        mutationFn: (number) => {
            if (!id) {
                return Promise.reject(
                    new Error('Cannot publish a revision on an unsaved entry.')
                );
            }
            return httpContentGateway.publishRevision(typeName, id, number);
        },
        onSuccess: (saved) => invalidate(saved.id)
    });

    return {
        /** Restore the entry to revision `number` (appends a new revision). */
        restore: restore.mutate,
        /** Whether a restore is in flight. */
        restoring: restore.isPending,
        /** The last restore error, if any (surfaced by the widget as a toast). */
        restoreError: restore.error,
        /** Publish revision `number` live (restore-if-needed + publish). */
        publish: publish.mutate,
        /** Whether a publish-version is in flight. */
        publishing: publish.isPending,
        /** The last publish-version error, if any. */
        publishError: publish.error
    };
}
