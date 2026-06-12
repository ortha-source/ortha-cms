import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import {
    membersKeys,
    updateMember,
    type UpdateMemberInput
} from '../membersApi';

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
