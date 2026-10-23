import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/**
 * How many entries of content type `slug` a workspace holds. Backs the revoke
 * pre-check — the remove dialog reads it on open to decide whether to block the
 * action — and the count each granted row shows. Runs only while `enabled` (i.e. a removal is pending) and isn't
 * cached across opens, so a just-added entry is reflected.
 */
export function useWorkspaceContentCount(
    workspaceId: string,
    slug: string | null,
    enabled: boolean,
    /**
     * `check` (the default) is the remove dialog's pre-check; `summary` is the
     * count a settings row shows. Separate keys, so a row's settled answer is
     * never what the dialog reads as its own check.
     */
    purpose: 'check' | 'summary' = 'check'
) {
    return useQuery({
        queryKey: [
            'workspaces',
            workspaceId,
            'content',
            slug,
            'entry-count',
            purpose
        ],
        queryFn: () =>
            httpWorkspaceGateway.contentEntryCount(workspaceId, slug as string),
        enabled: enabled && slug !== null,
        staleTime: 0,
        gcTime: 0
    });
}
