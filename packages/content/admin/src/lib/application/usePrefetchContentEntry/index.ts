import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { STALE_TIME } from '@orthacms/utils-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { contentEntryKey } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

/**
 * Warms the editor's read of one entry — the same key and fetch
 * `useContentEntry` uses — so opening it next draws the form at once instead
 * of the editor's loading state. For a control that knows where the reader is
 * about to go: the locale switcher prefetches the record's siblings as its
 * menu opens. A fresh copy already in the cache is left alone (`staleTime`).
 */
export function usePrefetchContentEntry(): (name: string, id: string) => void {
    const workspace = useCurrentWorkspace();
    const queryClient = useQueryClient();
    return useCallback(
        (name, id) => {
            void queryClient.prefetchQuery({
                queryKey: contentEntryKey(workspace.id, name, id),
                queryFn: () => httpContentGateway.getEntry(name, id),
                staleTime: STALE_TIME.Short
            });
        },
        [queryClient, workspace.id]
    );
}
