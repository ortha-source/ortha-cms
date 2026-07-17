import type { Member } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import type { SetMemberStatusInput } from '../../infrastructure/memberGateway';
import { useMembersMutation } from '../useMembersMutation';

export type { SetMemberStatusInput } from '../../infrastructure/memberGateway';

/**
 * Disables or re-enables a member's account (the row menu and the Access tab
 * both submit through here) via the gateway. One hook for the pair — the caller
 * renders exactly one direction at a time, and both invalidate the same cache.
 * Errors normalize to `ApiError`.
 */
export function useSetMemberStatus() {
    return useMembersMutation<SetMemberStatusInput, Member>((input) =>
        httpMemberGateway.setStatus(input)
    );
}
