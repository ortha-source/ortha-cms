import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/**
 * What archiving `workspaceId` would touch — records, members, and the
 * workspaces linking its shared records. Read when the archive confirmation
 * opens (`enabled`) and never cached across opens, so a count is as fresh as
 * the moment the question is asked.
 */
export function useArchiveImpact(workspaceId: string, enabled: boolean) {
    return useQuery({
        queryKey: ['workspaces', workspaceId, 'archive-impact'],
        queryFn: () => httpWorkspaceGateway.archiveImpact(workspaceId),
        enabled,
        staleTime: 0,
        gcTime: 0
    });
}
