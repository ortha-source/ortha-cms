import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { membersKeys } from '../../utils/membersKeys';

/** Revokes a pending invite via `DELETE /api/users/:id/invites`. */
async function revokeInvite(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}/invites`);
}

/**
 * Revokes a pending invite — the row disappears from the list (the server
 * deletes the placeholder account). Invalidates the members cache on
 * success. Errors normalize to {@link ApiError}.
 */
export function useRevokeInvite() {
    const queryClient = useQueryClient();

    return useMutation<void, ApiError, string>({
        mutationFn: (id) => revokeInvite(id).catch(rethrowAsApiError),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: membersKeys.all });
        }
    });
}

function rethrowAsApiError(error: unknown): never {
    throw toApiError(error);
}
