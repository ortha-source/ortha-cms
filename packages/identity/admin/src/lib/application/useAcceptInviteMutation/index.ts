import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '@ortha-cms/utils-admin';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';
import type { AcceptInviteInput } from '../../../types/auth';

/**
 * TanStack Query mutation for accepting an invite. Delegates to the
 * {@link AuthGateway} (`POST /api/auth/invite/accept`); on success the server
 * activates the account and sets the `httpOnly` session cookie, so this
 * resolves with no value and the invitee is already signed in — the caller only
 * has to refresh the current user and navigate.
 *
 * The thrown error is an {@link ApiError}, so callers can branch on
 * `error.status` (`HTTP_STATUS.NOT_FOUND` = the link is dead,
 * `HTTP_STATUS.BAD_REQUEST` = the password was rejected server-side).
 */
export function useAcceptInviteMutation() {
    return useMutation<void, ApiError, AcceptInviteInput>({
        mutationFn: (input) => httpAuthGateway.acceptInvite(input)
    });
}
