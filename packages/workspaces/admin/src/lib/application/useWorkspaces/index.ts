import { useQuery } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';

/** Query key for the workspaces list; mutations invalidate it on success. */
export const workspacesKey = ['workspaces'] as const;

/** Lists the workspaces the signed-in user can see, via the workspace gateway. */
export function useWorkspaces() {
    return useQuery({
        queryKey: workspacesKey,
        queryFn: () => httpWorkspaceGateway.list()
    });
}
