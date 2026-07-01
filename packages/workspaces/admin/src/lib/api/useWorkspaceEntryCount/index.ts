import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';

/** Response of `GET /api/workspaces/:id/entry-count`. */
interface EntryCountView {
    /** Total entries across every content type in the workspace. */
    count: number;
}

/** Fetches the workspace's total content-entry count. */
async function fetchCount(workspaceId: string): Promise<number> {
    try {
        const { data } = await apiClient.get<EntryCountView>(
            `/workspaces/${workspaceId}/entry-count`
        );
        return data.count;
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * How many content entries a workspace holds across all its content types.
 * Backs the delete pre-check: the delete dialog reads it on open to decide
 * whether to block deletion. Runs only while `enabled` (a delete is pending) and
 * isn't cached across opens, so a just-removed entry is reflected.
 */
export function useWorkspaceEntryCount(workspaceId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['workspaces', workspaceId, 'entry-count'],
        queryFn: () => fetchCount(workspaceId),
        enabled,
        staleTime: 0,
        gcTime: 0
    });
}
