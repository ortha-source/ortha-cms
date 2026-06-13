import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { Member, MemberRole } from '../../types/member';
import { membersKeys } from '../../utils/membersKeys';
import { toMember, type MemberResponse } from '../../utils/toMember';

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
 * dialog both submit through here). Errors normalize to {@link ApiError} —
 * `HTTP_STATUS.CONFLICT` means the last-admin guardrail rejected a demotion
 * that raced past the disabled UI. Invalidates the members cache on success.
 */
export function useUpdateMember() {
    const queryClient = useQueryClient();

    return useMutation<Member, ApiError, UpdateMemberInput>({
        mutationFn: (input) => updateMember(input).catch(rethrowAsApiError),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: membersKeys.all });
        }
    });
}

function rethrowAsApiError(error: unknown): never {
    throw toApiError(error);
}
