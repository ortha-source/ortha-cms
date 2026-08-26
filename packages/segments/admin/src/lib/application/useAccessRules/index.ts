import { useQuery } from '@tanstack/react-query';
import { httpSegmentsGateway } from '../../infrastructure/httpSegmentsGateway';
import { segmentsKeys } from '../../infrastructure/segmentsKeys';

/**
 * Every rule the open workspace can use — its own, plus the installation-wide
 * ones it may apply but not edit.
 *
 * `workspaceId` is a cache-key input, not a request parameter: the workspace
 * reaches the server as `apiClient`'s ambient `X-Workspace-Id` header. Leaving
 * it out of the key would serve workspace A's rules to workspace B out of
 * cache — a rule list is small enough that the mistake would never look like a
 * performance bug, only like the wrong answer.
 */
export function useAccessRules(workspaceId: string, enabled = true) {
    return useQuery({
        queryKey: segmentsKeys.rules(workspaceId),
        queryFn: () => httpSegmentsGateway.listRules(),
        enabled: enabled && Boolean(workspaceId)
    });
}
