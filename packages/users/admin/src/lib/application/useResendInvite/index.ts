import type { Member } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { useMembersMutation } from '../useMembersMutation';

/**
 * Re-sends a pending member's invite via the gateway (the server rotates the
 * token, invalidating the previous link). No cache invalidation — the row
 * itself is unchanged. Errors normalize to `ApiError`.
 */
export function useResendInvite() {
    return useMembersMutation<string, Member>(
        (id) => httpMemberGateway.resendInvite(id),
        { invalidate: false }
    );
}
