import { apiClient } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import { toMember, type MemberResponse } from '../../utils/toMember';
import { useMembersMutation } from '../useMembersMutation';

/** Input for {@link useSetMemberStatus}: who, and which way to flip. */
export type SetMemberStatusInput = {
    /** The member to update. */
    id: string;
    /** `true` disables the account, `false` re-enables it. */
    disabled: boolean;
};

/** Disables an active member via `POST /api/users/:id/disable`. */
async function disableMember(id: string): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        `/users/${id}/disable`
    );
    return toMember(data);
}

/** Re-enables a disabled member via `POST /api/users/:id/enable`. */
async function enableMember(id: string): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        `/users/${id}/enable`
    );
    return toMember(data);
}

/**
 * Disables or re-enables a member's account from the row menu. One hook for
 * the pair — the menu renders exactly one of the two actions per row, and
 * both invalidate the same cache. Errors normalize to `ApiError`.
 */
export function useSetMemberStatus() {
    return useMembersMutation<SetMemberStatusInput, Member>((input) =>
        input.disabled ? disableMember(input.id) : enableMember(input.id)
    );
}
