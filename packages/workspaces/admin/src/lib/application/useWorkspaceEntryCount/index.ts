import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/**
 * How many content entries a workspace holds across all its content types.
 * Backs the delete pre-check: the delete dialog reads it on open to decide
 * whether to block deletion. Runs only while `enabled` (a delete is pending) and
 * isn't cached across opens, so a just-removed entry is reflected.
 */
export function useWorkspaceEntryCount(
    workspaceId: string,
    enabled: boolean,
    /**
     * `check` (the default) is the delete dialog's pre-check; `summary` is the
     * Danger zone's sentence about what the workspace still holds. Separate
     * keys, so the page's settled answer never stands in for the dialog's.
     */
    purpose: 'check' | 'summary' = 'check'
) {
    return useQuery({
        queryKey: ['workspaces', workspaceId, 'entry-count', purpose],
        queryFn: () => httpWorkspaceGateway.entryCount(workspaceId),
        enabled,
        staleTime: 0,
        gcTime: 0
    });
}
