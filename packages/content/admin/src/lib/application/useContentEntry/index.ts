import { useQuery } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { EntryRecord } from '../../domain/types/contentType';
import { contentEntryKey } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

export {
    contentEntryKey,
    contentEntryPrefix
} from '../../infrastructure/contentKeys';

/**
 * Reads one entry for the editor's edit mode via the content gateway.
 * `initialData` (seeded from the records-list cache when the row was opened from
 * the table) keeps the form instant on the common path while a fresh copy
 * refetches in the background; a deep link / reload with no cache simply fetches.
 * Disabled when there's no id. The cache key is workspace-scoped.
 */
export function useContentEntry(
    name: string,
    id: string | undefined,
    options: { initialData?: EntryRecord; enabled?: boolean } = {}
) {
    const workspace = useCurrentWorkspace();
    return useQuery({
        queryKey: contentEntryKey(workspace.id, name, id ?? ''),
        queryFn: () => httpContentGateway.getEntry(name, id as string),
        enabled: (options.enabled ?? true) && !!id,
        initialData: options.initialData
    });
}
