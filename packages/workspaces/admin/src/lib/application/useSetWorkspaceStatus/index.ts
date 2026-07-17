import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { SetWorkspaceStatusInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { SetWorkspaceStatusInput } from '../../infrastructure/workspaceGateway';

/**
 * Flips a workspace between active and archived via the gateway (which picks the
 * `archive`/`unarchive` route from the target status). Invalidates the
 * workspaces list on success so the shell and grid reflect the new status.
 */
export function useSetWorkspaceStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: SetWorkspaceStatusInput) =>
            httpWorkspaceGateway.setStatus(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
