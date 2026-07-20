import type { Member } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import type { UpdateMemberInput } from '../../infrastructure/memberGateway';
import { useMembersMutation } from '../useMembersMutation';

export type { UpdateMemberInput } from '../../infrastructure/memberGateway';

/**
 * Edits a member's name and/or role (the Role tab and the General tab both
 * submit through here) via the gateway. Errors normalize to `ApiError` —
 * `HTTP_STATUS.CONFLICT` means the last-admin guardrail (or the self-role
 * guard) rejected the change. Invalidates the members cache on success.
 */
export function useUpdateMember() {
    return useMembersMutation<UpdateMemberInput, Member>((input) =>
        httpMemberGateway.update(input)
    );
}
