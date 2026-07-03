import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';

/** Response of `GET /api/workspaces/:id/content/:slug/entry-count`. */
interface ContentCountView {
    /** Entries of the content type currently stored in the workspace. */
    count: number;
}

/** Fetches the entry count for one content type in a workspace. */
async function fetchCount(
    workspaceId: string,
    slug: string
): Promise<number> {
    try {
        const { data } = await apiClient.get<ContentCountView>(
            `/workspaces/${workspaceId}/content/${slug}/entry-count`
        );
        return data.count;
    } catch (error) {
        throw toApiError(error);
    }
}

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
        queryFn: () => fetchCount(workspaceId, slug as string),
        enabled: enabled && slug !== null,
        staleTime: 0,
        gcTime: 0
    });
}
