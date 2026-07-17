import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { RemoveWorkspaceMemberInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { RemoveWorkspaceMemberInput } from '../../infrastructure/workspaceGateway';

/**
 * Removes a member from a workspace via the gateway (a no-op server-side if they
 * weren't one). Invalidates the workspaces list so the roster updates.
 */
export function useRemoveWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: RemoveWorkspaceMemberInput) =>
            httpWorkspaceGateway.removeMember(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
