import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/**
 * How many entries of content type `slug` a workspace holds. Backs the revoke
 * pre-check: the remove dialog reads it on open to decide whether to block the
 * action. Runs only while `enabled` (i.e. a removal is pending) and isn't
 * cached across opens, so a just-added entry is reflected.
 */
export function useWorkspaceContentCount(
    workspaceId: string,
    slug: string | null,
    enabled: boolean
) {
    return useQuery({
        queryKey: ['workspaces', workspaceId, 'content', slug, 'entry-count'],
        queryFn: () =>
            httpWorkspaceGateway.contentEntryCount(workspaceId, slug as string),
        enabled: enabled && slug !== null,
        staleTime: 0,
        gcTime: 0
    });
}
