import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { membersKeys } from '../../utils/membersKeys';

/** Identifies the membership to remove: which member, which workspace. */
export type RemoveWorkspaceMemberInput = {
    /** The member being removed. */
    userId: string;
    /** The workspace to remove them from. */
    workspaceId: string;
};

/** Unlinks a member via `DELETE /api/workspaces/:id/members/:userId`. */
async function removeWorkspaceMember({
    userId,
    workspaceId
}: RemoveWorkspaceMemberInput): Promise<void> {
    await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`);
}

/**
 * Removes a member from a workspace from the Workspaces tab. Invalidates the
 * member's detail (its `workspaces` list) and the members list (its Workspaces
 * column) on success. Errors normalize to {@link ApiError}.
 */
export function useRemoveWorkspaceMember() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, RemoveWorkspaceMemberInput>({
        mutationFn: (input) =>
            removeWorkspaceMember(input).catch((error) => {
                throw toApiError(error);
            }),
        onSuccess: (_data, { userId }) => {
            queryClient.invalidateQueries({
                queryKey: membersKeys.detail(userId)
            });
            queryClient.invalidateQueries({ queryKey: membersKeys.all });
        }
    });
}
