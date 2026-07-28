import { useQuery } from '@tanstack/react-query';
import { httpApiTokenGateway } from '../../infrastructure/httpApiTokenGateway';

export type { WorkspaceOption } from '../../domain/types/workspaceOption';

/** Query key for the workspace options list. */
export const workspaceOptionsKey = ['workspaces', 'options'] as const;

/**
 * Lists every workspace (via the gateway's `GET /api/workspaces`) for the
 * create-token dialog's workspace selector. `enabled` defers the fetch until the
 * dialog is opened.
 */
export function useWorkspaceOptions(enabled = true) {
    return useQuery({
        queryKey: workspaceOptionsKey,
        queryFn: () => httpApiTokenGateway.listWorkspaceOptions(),
        enabled,
        staleTime: 60_000
    });
}
