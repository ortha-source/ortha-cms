import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import {
    inviteMember,
    membersKeys,
    type InviteMemberInput
} from '../membersApi';

/**
 * Invites a person by email. Errors are normalized to {@link ApiError} so the
 * dialog can branch on `HTTP_STATUS.CONFLICT` (email already taken); every
 * page of the members cache is refreshed on success — the new "Invited" row
 * may land on any page.
 */
export function useInviteMember() {
    const queryClient = useQueryClient();

    return useMutation<Member, ApiError, InviteMemberInput>({
        mutationFn: (input) => inviteMember(input).catch(rethrowAsApiError),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: membersKeys.all });
        }
    });
}

function rethrowAsApiError(error: unknown): never {
    throw toApiError(error);
}
