import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@orthacms/utils-admin';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { membersKeys } from '../../infrastructure/membersKeys';

/**
 * Signs a member out of every device ("Sign out everywhere"), resolving with
 * how many sessions ended. The caller's own session is kept server-side.
 * Refreshes only that member's session list — no member field changes.
 */
export function useRevokeAllSessions() {
    const queryClient = useQueryClient();
    return useMutation<number, ApiError, string>({
        mutationFn: (id) => httpMemberGateway.revokeAllSessions(id),
        onSuccess: (_count, id) => {
            queryClient.invalidateQueries({
                queryKey: membersKeys.sessions(id)
            });
        }
    });
}
