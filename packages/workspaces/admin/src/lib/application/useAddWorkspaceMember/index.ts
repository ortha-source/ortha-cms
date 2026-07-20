import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { AddWorkspaceMemberInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { AddWorkspaceMemberInput } from '../../infrastructure/workspaceGateway';

/**
 * Adds an existing user to a workspace via the gateway (idempotent server-side).
 * Invalidates the workspaces list so the member appears in the settings roster.
 */
export function useAddWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: AddWorkspaceMemberInput) =>
            httpWorkspaceGateway.addMember(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
