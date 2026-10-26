import type { InvitedMember } from '../../domain/types/member';
import { httpMemberGateway } from '../../infrastructure/httpMemberGateway';
import type { InviteMembersInput } from '../../infrastructure/memberGateway';
import { useMembersMutation } from '../useMembersMutation';

export type { InviteMembersInput } from '../../infrastructure/memberGateway';

/**
 * Invites several people at once via the gateway — the invite sheet's submit.
 * All-or-nothing server-side: it resolves with every new member (each with its
 * one-time token unless a mailer sent it), or rejects with an `ApiError` whose
 * `409` body names every address that already belongs to a member. Refreshes
 * the members cache on success, since the new "Invited" rows may land on any
 * page and the quick-filter counts moved.
 */
export function useInviteMembers() {
    return useMembersMutation<InviteMembersInput, InvitedMember[]>((input) =>
        httpMemberGateway.inviteMany(input)
    );
}
