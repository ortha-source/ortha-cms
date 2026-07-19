import { useQuery } from '@tanstack/react-query';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';

export type { WorkspaceOption } from '../../domain/types/workspaceOption';

/** Query key for the workspace options list. */
export const workspaceOptionsKey = ['workspaces', 'options'] as const;

/**
 * Lists every workspace (via the gateway's `GET /api/workspaces`) for the invite
 * wizard's "assign workspaces" step and the user-detail add-to-workspaces
 * dialog. `enabled` defers the fetch until the step/dialog is reached.
 */
export function useWorkspaceOptions(enabled = true) {
    return useQuery({
        queryKey: workspaceOptionsKey,
        queryFn: () => httpMemberGateway.listWorkspaceOptions(),
        enabled,
        staleTime: 60_000
    });
}
