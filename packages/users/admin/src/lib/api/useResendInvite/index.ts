import { apiClient } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import { toMember, type MemberResponse } from '../../utils/toMember';
import { useMembersMutation } from '../useMembersMutation';

/** Rotates a pending invite via `POST /api/users/:id/invites/resend`. */
async function resendInvite(id: string): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        `/users/${id}/invites/resend`
    );
    return toMember(data);
}

/**
 * Re-sends a pending member's invite (the server rotates the token,
 * invalidating the previous link). No cache invalidation — the row itself is
 * unchanged. Errors normalize to `ApiError`.
 */
export function useResendInvite() {
    return useMembersMutation<string, Member>(resendInvite, {
        invalidate: false
    });
}
