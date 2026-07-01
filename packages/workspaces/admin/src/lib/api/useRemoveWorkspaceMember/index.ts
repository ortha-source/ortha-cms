import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { workspacesKey } from '../useWorkspaces';

/** Removes a member's link to a workspace. */
export type RemoveWorkspaceMemberInput = {
    /** The workspace to remove the member from. */
    workspaceId: string;
    /** The member's user id. */
    userId: string;
};

/** Removes a member via `DELETE /api/workspaces/:id/members/:userId`. */
async function removeWorkspaceMember({
    workspaceId,
    userId
}: RemoveWorkspaceMemberInput): Promise<void> {
    try {
        await apiClient.delete(
            `/workspaces/${workspaceId}/members/${userId}`
        );
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * Removes a member from a workspace (a no-op server-side if they weren't one).
 * Invalidates the workspaces list so the roster updates.
 */
export function useRemoveWorkspaceMember() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: removeWorkspaceMember,
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: workspacesKey })
    });
}
