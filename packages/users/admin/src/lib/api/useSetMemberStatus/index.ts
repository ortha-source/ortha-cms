import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import { disableMember, enableMember, membersKeys } from '../membersApi';

/** Input for {@link useSetMemberStatus}: who, and which way to flip. */
export type SetMemberStatusInput = {
    /** The member to update. */
    id: string;
    /** `true` disables the account, `false` re-enables it. */
    disabled: boolean;
};

/**
 * Disables or re-enables a member's account from the row menu. One hook for
 * the pair — the menu renders exactly one of the two actions per row, and
 * both invalidate the same cache. Errors normalize to {@link ApiError}.
 */
export function useSetMemberStatus() {
    const queryClient = useQueryClient();

    return useMutation<Member, ApiError, SetMemberStatusInput>({
        mutationFn: (input) =>
            (input.disabled
                ? disableMember(input.id)
                : enableMember(input.id)
            ).catch(rethrowAsApiError),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: membersKeys.all });
        }
    });
}

function rethrowAsApiError(error: unknown): never {
    throw toApiError(error);
}
