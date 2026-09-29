import { useQuery } from '@tanstack/react-query';
import { STALE_TIME } from '@orthacms/utils-admin';
import { useCurrentWorkspace } from '@orthacms/workspaces-admin';
import { entryUsagesKey } from '../../infrastructure/contentKeys';
import { httpContentGateway } from '../../infrastructure/httpContentGateway';

/**
 * Reads which **other** workspaces link to one entry, via
 * `GET /content/:name/:id/usages` — `{ workspaceId, workspaceName, count }` per
 * linking workspace. Only a shared workspace's records can be linked from
 * elsewhere, so the caller enables it only there (and only for a saved entry).
 *
 * `retry: false`: the only consumer is a rail block that hides itself on a
 * failure rather than reporting one, so retrying would just hold the block in
 * a loading state for the length of the backoff.
 */
export function useEntryUsages(
    name: string,
    id: string | undefined,
    enabled = true
) {
    const workspace = useCurrentWorkspace();
    return useQuery({
        queryKey: entryUsagesKey(workspace.id, name, id ?? ''),
        queryFn: () => httpContentGateway.getEntryUsages(name, id as string),
        enabled: enabled && !!id,
        staleTime: STALE_TIME.Short,
        retry: false
    });
}
