import { apiClient } from '@ortha-cms/utils-admin';
import type { Member, MemberRole } from '../../types/member';
import { toMember, type MemberResponse } from '../../utils/toMember';
import { useMembersMutation } from '../useMembersMutation';

/** A partial member edit; omitted fields are left unchanged. */
export type UpdateMemberInput = {
    id: string;
    name?: string;
    role?: MemberRole;
};

/** Edits name and/or role via `PATCH /api/users/:id`; 409 = last admin. */
async function updateMember(input: UpdateMemberInput): Promise<Member> {
    const { id, ...body } = input;
    const { data } = await apiClient.patch<MemberResponse>(
        `/users/${id}`,
        body
    );
    return toMember(data);
}

/**
 * Edits a member's name and/or role (the inline role select and the Edit
 * dialog both submit through here). Errors normalize to `ApiError` —
 * `HTTP_STATUS.CONFLICT` means the last-admin guardrail (or the self-role
 * guard) rejected the change. Invalidates the members cache on success.
 */
export function useUpdateMember() {
    return useMembersMutation<UpdateMemberInput, Member>(updateMember);
}
