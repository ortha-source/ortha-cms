import { useMutation } from '@tanstack/react-query';
import type { ApiError } from '@ortha-cms/utils-admin';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';
import type { LoginCredentials } from '../../../types/auth';

/**
 * TanStack Query mutation for signing in. Delegates to the {@link AuthGateway}
 * (`POST /api/auth/login`); on success the server sets the `httpOnly` session
 * cookie and this resolves with no value — the cookie is the auth state. The
 * thrown error is an {@link ApiError}, so callers can branch on `error.status`
 * (e.g. `HTTP_STATUS.UNAUTHORIZED`). Navigation/UI is left to the caller via
 * `mutate(credentials, { onSuccess })`.
 */
export function useLoginMutation() {
    return useMutation<void, ApiError, LoginCredentials>({
        mutationFn: (credentials) => httpAuthGateway.login(credentials)
    });
}
