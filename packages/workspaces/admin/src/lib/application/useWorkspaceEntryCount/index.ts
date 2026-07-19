import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/**
 * How many content entries a workspace holds across all its content types.
 * Backs the delete pre-check: the delete dialog reads it on open to decide
 * whether to block deletion. Runs only while `enabled` (a delete is pending) and
 * isn't cached across opens, so a just-removed entry is reflected.
 */
export function useWorkspaceEntryCount(workspaceId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['workspaces', workspaceId, 'entry-count'],
        queryFn: () => httpWorkspaceGateway.entryCount(workspaceId),
        enabled,
        staleTime: 0,
        gcTime: 0
    });
}
