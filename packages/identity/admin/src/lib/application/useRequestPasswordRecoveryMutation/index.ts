import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '@orthacms/utils-admin';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';

/**
 * TanStack Query mutation for the public "forgot your password?" request
 * (`POST /api/auth/password-recovery`).
 *
 * Success means only that the request was **accepted** — the server answers
 * before it looks the address up, so the page must say "if it belongs to an
 * account" and nothing firmer. Errors are an {@link ApiError}: `404` (this
 * deployment sends no mail after all), `429` (too many requests from this
 * device), `400` (not an email address).
 */
export function useRequestPasswordRecoveryMutation() {
    return useMutation<void, ApiError, string>({
        mutationFn: (email) => httpAuthGateway.requestPasswordRecovery(email)
    });
}
