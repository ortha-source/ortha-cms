import type { InvitedMember } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import { useMembersMutation } from '../useMembersMutation';

/**
 * Re-sends a pending member's invite via the gateway (the server rotates the
 * token, invalidating the previous link). Resolves with the member **and** the
 * fresh raw token, so the caller can show the new link — rotating without
 * handing the new link over would leave the invitee with a dead one. No cache
 * invalidation: the row itself is unchanged. Errors normalize to `ApiError`.
 */
export function useResendInvite() {
    return useMembersMutation<string, InvitedMember>(
        (id) => httpMemberGateway.resendInvite(id),
        { invalidate: false }
    );
}
