import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import { sharedSourcesKey } from '../../infrastructure/contentAccessKeys';

export { sharedSourcesKey } from '../../infrastructure/contentAccessKeys';

/**
 * The shared workspaces `workspaceId` can be granted content from, each with
 * the types it holds (`GET /workspaces/:id/shared-sources`). Backs the settings
 * tab's Add dialogs. Pass `enabled = false` for a reader who cannot grant
 * anything — they never open the dialog that needs it.
 */
export function useSharedSources(workspaceId: string, enabled = true) {
    return useQuery({
        queryKey: sharedSourcesKey(workspaceId),
        queryFn: () => httpWorkspaceGateway.listSharedSources(workspaceId),
        enabled
    });
}
