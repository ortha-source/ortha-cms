import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ApiError } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { EntryRecord } from '../../domain/types/contentType';
import {
    contentEntriesPrefix,
    contentEntryPrefix,
    entryRevisionsPrefix
} from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

/**
 * Single-entry lifecycle mutations over the content gateway, shared by the records
 * row menu and the editor sidebar: publish / unpublish (publishable types), and
 * remove / restore / purge (soft-delete lifecycle). Each takes an entry id and
 * invalidates the type's records list on success. Publish can 422 (the stored row
 * fails validation) — callers surface `error.details.issues`.
 */
export function useEntryStatusActions(typeName: string) {
    const queryClient = useQueryClient();
    const workspace = useCurrentWorkspace();
    // Invalidate both the records list and any cached read-one for this type, so
    // the editor's view of a published/unpublished/restored entry stays fresh.
    const invalidate = () => {
        queryClient.invalidateQueries({
            queryKey: contentEntriesPrefix(workspace.id, typeName)
        });
        queryClient.invalidateQueries({
            queryKey: contentEntryPrefix(workspace.id, typeName)
        });
        // Publish/unpublish transition the entry's latest revision, so refresh
        // the timeline (right-rail widget + History tab) to show the new status.
        queryClient.invalidateQueries({
            queryKey: entryRevisionsPrefix(workspace.id, typeName)
        });
    };

    const publish = useMutation<EntryRecord, ApiError, string>({
        mutationFn: (id) => httpContentGateway.publish(typeName, id),
        onSuccess: invalidate
    });

    const unpublish = useMutation<EntryRecord, ApiError, string>({
        mutationFn: (id) => httpContentGateway.unpublish(typeName, id),
        onSuccess: invalidate
    });

    const remove = useMutation<void, ApiError, string>({
        mutationFn: (id) => httpContentGateway.remove(typeName, id),
        onSuccess: invalidate
    });

    const restore = useMutation<EntryRecord, ApiError, string>({
        mutationFn: (id) => httpContentGateway.restore(typeName, id),
        onSuccess: invalidate
    });

    const purge = useMutation<void, ApiError, string>({
        mutationFn: (id) => httpContentGateway.purge(typeName, id),
        onSuccess: invalidate
    });

    return { publish, unpublish, remove, restore, purge };
}
