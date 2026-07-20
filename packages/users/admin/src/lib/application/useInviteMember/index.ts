import type { Member } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import type { InviteMemberInput } from '../../infrastructure/memberGateway';
import { useMembersMutation } from '../useMembersMutation';

export type { InviteMemberInput } from '../../infrastructure/memberGateway';

/**
 * Invites a person by email via the gateway. Errors are normalized to
 * `ApiError` so the invite flow can branch on `HTTP_STATUS.CONFLICT` (email
 * already taken); every page of the members cache is refreshed on success — the
 * new "Invited" row may land on any page.
 */
export function useInviteMember() {
    return useMembersMutation<InviteMemberInput, Member>((input) =>
        httpMemberGateway.invite(input)
    );
}
