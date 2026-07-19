import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { RemoveWorkspaceContentInput } from '../../infrastructure/workspaceGateway';
import { workspacesKey } from '../useWorkspaces';

export type { RemoveWorkspaceContentInput } from '../../infrastructure/workspaceGateway';

/**
 * Revokes a workspace's access to a content type via the gateway — only when
 * it's empty (a `409` otherwise, surfaced via the thrown `ApiError`, which the
 * caller narrows with `isConflict`). Invalidates the workspaces list on success.
 */
export function useRemoveWorkspaceContent() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: RemoveWorkspaceContentInput) =>
            httpWorkspaceGateway.removeContent(input),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
