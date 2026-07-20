import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { UpdateWorkspaceInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { UpdateWorkspaceInput } from '../../infrastructure/workspaceGateway';

/**
 * Edits a workspace's name / description / color via the workspace gateway. On
 * success it invalidates the workspaces list so the shell (which reads the open
 * workspace from that list) re-resolves with the new values.
 */
export function useUpdateWorkspace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: UpdateWorkspaceInput) =>
            httpWorkspaceGateway.update(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
