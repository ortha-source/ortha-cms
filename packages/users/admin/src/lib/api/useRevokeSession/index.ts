import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import { membersKeys } from '../../utils/membersKeys';

/** Identifies the session to revoke: whose, and which. */
export type RevokeSessionInput = {
    /** The member who owns the session. */
    userId: string;
    /** The session row id to revoke. */
    sessionId: string;
};

/** Revokes one session via `DELETE /api/users/:id/sessions/:sessionId`. */
async function revokeSession({
    userId,
    sessionId
}: RevokeSessionInput): Promise<void> {
    await apiClient.delete(`/users/${userId}/sessions/${sessionId}`);
}

/**
 * Revokes a member's session from the Sessions tab. Invalidates that member's
 * sessions query on success so the revoked row drops off. Errors normalize to
 * {@link ApiError}.
 */
export function useRevokeSession() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, RevokeSessionInput>({
        mutationFn: (input) =>
            revokeSession(input).catch((error) => {
                throw toApiError(error);
            }),
        onSuccess: (_data, { userId }) => {
            queryClient.invalidateQueries({
                queryKey: membersKeys.sessions(userId)
            });
        }
    });
}
