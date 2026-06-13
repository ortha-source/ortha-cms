import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { Member, MemberRole } from '../../types/member';
import { membersKeys } from '../../utils/membersKeys';
import { toMember, type MemberResponse } from '../../utils/toMember';

/** The shape the invite form submits. */
export type InviteMemberInput = {
    email: string;
    role: MemberRole;
    name?: string;
    /** Workspaces to grant the new member access to (optional). */
    workspaceIds?: string[];
};

/** Invites a person via `POST /api/users/invites`; 409 = email taken. */
async function inviteMember(input: InviteMemberInput): Promise<Member> {
    const { data } = await apiClient.post<MemberResponse>(
        '/users/invites',
        input
    );
    return toMember(data);
}

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
