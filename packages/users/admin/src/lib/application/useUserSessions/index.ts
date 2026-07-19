import { useQuery } from '@tanstack/react-query';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { membersKeys } from '../../infrastructure/membersKeys';

export type { UserSession } from '../../domain/types/session';

/**
 * Fetches the live sessions for a member (the Sessions tab) via the gateway.
 * `staleTime: 0` so a session that has since expired or been revoked elsewhere
 * drops off on the next mount/refocus rather than lingering. Gated on
 * `users:update` (the tab is only shown to admins who can act on what they see).
 */
export function useUserSessions(id: string, enabled = true) {
    return useQuery({
        queryKey: membersKeys.sessions(id),
        queryFn: () => httpMemberGateway.listSessions(id),
        staleTime: 0,
        enabled
    });
}
