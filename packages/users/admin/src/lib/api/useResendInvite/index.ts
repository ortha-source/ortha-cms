import { useMutation } from '@tanstack/react-query';
import { toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { Member } from '../../types/member';
import { resendInvite } from '../membersApi';

/**
 * Re-sends a pending member's invite (the server rotates the token,
 * invalidating the previous link). No cache invalidation — the row itself is
 * unchanged. Errors normalize to {@link ApiError}.
 */
export function useResendInvite() {
    return useMutation<Member, ApiError, string>({
        mutationFn: (id) => resendInvite(id).catch(rethrowAsApiError)
    });
}

function rethrowAsApiError(error: unknown): never {
    throw toApiError(error);
}
