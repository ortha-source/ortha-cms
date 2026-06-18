import { apiClient } from '@ortha-cms/utils-admin';
import { useMembersMutation } from '../useMembersMutation';

/** Revokes a pending invite via `DELETE /api/users/:id/invites`. */
async function revokeInvite(id: string): Promise<void> {
    await apiClient.delete(`/users/${id}/invites`);
}

/**
 * Revokes a pending invite — the row disappears from the list (the server
 * deletes the placeholder account). Invalidates the members cache on
 * success. Errors normalize to `ApiError`.
 */
export function useRevokeInvite() {
    return useMembersMutation<string, void>(revokeInvite);
}
