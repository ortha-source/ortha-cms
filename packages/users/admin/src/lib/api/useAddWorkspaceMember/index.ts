import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { membersKeys } from '../../utils/membersKeys';

/** Identifies the membership to create: which member, which workspace. */
export type AddWorkspaceMemberInput = {
    /** The member being added. */
    userId: string;
    /** The workspace to add them to. */
    workspaceId: string;
};

/** Links a member to a workspace via `POST /api/workspaces/:id/members`. */
async function addWorkspaceMember({
    userId,
    workspaceId
}: AddWorkspaceMemberInput): Promise<void> {
    await apiClient.post(`/workspaces/${workspaceId}/members`, { userId });
}

/**
 * Adds a member to a workspace from the Workspaces tab. The endpoint is
 * idempotent (re-adding is a no-op). Invalidates the member's detail (its
 * `workspaces` list) and the members list (its Workspaces column) on success.
 * Errors normalize to {@link ApiError}.
 */
export function useAddWorkspaceMember() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, AddWorkspaceMemberInput>({
        mutationFn: (input) =>
            addWorkspaceMember(input).catch((error) => {
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
