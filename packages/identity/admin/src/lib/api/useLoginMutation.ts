import { useMutation } from '@tanstack/react-query';
import { apiClient, toApiError, type ApiError } from '@ortha-cms/utils-admin';
import type { LoginCredentials } from '../../types/auth.type';

/**
 * Posts credentials to `POST /api/auth/login` via the shared `apiClient`
 * (base URL `/api`). On success the server sets the `httpOnly` `ortha_session`
 * cookie and this resolves with no value — the cookie is the auth state, so
 * nothing is returned.
 *
 * @throws {ApiError} normalized failure; callers branch on `error.status`
 * (a `401` means invalid credentials).
 */
async function login(credentials: LoginCredentials): Promise<void> {
    try {
        await apiClient.post('/auth/login', credentials);
    } catch (error) {
        throw toApiError(error);
    }
}

/**
 * TanStack Query mutation for signing in. Wraps the `login` request above; the
 * thrown error is an {@link ApiError}, so callers can branch on `error.status`
 * (e.g. `HTTP_STATUS.UNAUTHORIZED`). Navigation/UI is left to the caller via
 * `mutate(credentials, { onSuccess })`.
 */
export function useLoginMutation() {
    return useMutation<void, ApiError, LoginCredentials>({
        mutationFn: login
    });
}
