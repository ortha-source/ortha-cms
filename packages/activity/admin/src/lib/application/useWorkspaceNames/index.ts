import { useQuery } from '@tanstack/react-query';
import { httpActivityGateway } from '../../infrastructure/httpActivityGateway';
import { activityKeys } from '../../infrastructure/activityKeys';

/**
 * Workspace id → name, so a feed sentence can end "in Marketing site".
 *
 * Decoration, not data: the log is complete without it, so a failure or a
 * slow answer must never hold the feed back — the sentence simply omits the
 * place until (unless) the names arrive. Long-lived (`staleTime` five minutes)
 * because workspaces are renamed rarely and the feed re-renders often.
 *
 * Gated on the caller's `activity:read` like every other read here
 * (`activity:I-28`): without it, nothing is asked.
 */
export function useWorkspaceNames(enabled = true) {
    return useQuery({
        queryKey: activityKeys.workspaceNames,
        queryFn: () => httpActivityGateway.workspaceNames(),
        staleTime: 5 * 60_000,
        retry: false,
        enabled
    });
}
