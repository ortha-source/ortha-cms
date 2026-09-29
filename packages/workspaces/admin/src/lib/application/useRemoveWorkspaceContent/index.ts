import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWorkspaceGateway } from '../../infrastructure/httpWorkspaceGateway';
import type { RemoveWorkspaceContentInput } from '../../infrastructure/workspaceGateway';
import { workspaceContentAccessKey } from '../../infrastructure/contentAccessKeys';
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
        onSuccess: (_workspace, { workspaceId }) => {
            // What this workspace can reach just changed: its content-type
            // list (`access`) and its shared-sources catalogue. Not awaited —
            // the grant has landed, and the dialog shouldn't wait on the nav's
            // refetch to close.
            void queryClient.invalidateQueries({
                queryKey: workspaceContentAccessKey(workspaceId)
            });
            return queryClient.invalidateQueries({ queryKey: workspacesKey });
        }
    });
}
