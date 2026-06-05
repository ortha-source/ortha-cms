import { useMutation } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@ortha-cms/bootstrap-admin';
import type { LoginCredentials } from '../../types/auth.type';

/**
 * Error thrown when a login request does not succeed. `invalidCredentials` is
 * `true` for the server's generic `401` (wrong email/password), and `false` for
 * any other failure (network error, `5xx`, …) so the UI can show a distinct
 * message.
 */
export class LoginError extends Error {
    /** Whether the failure was a `401` (bad credentials) vs. an unexpected error. */
    readonly invalidCredentials: boolean;

    constructor(invalidCredentials: boolean) {
        super(invalidCredentials ? 'Invalid credentials' : 'Login failed');
        this.name = 'LoginError';
        this.invalidCredentials = invalidCredentials;
    }
}

/**
 * Posts credentials to `POST /api/auth/login` via the shared {@link apiClient}
 * (base URL `/api`). On success the server sets the `httpOnly` `ortha_session`
 * cookie and this resolves with no value — the cookie is the auth state, so
 * nothing is returned.
 *
 * @throws {LoginError} `invalidCredentials = true` on a `401`; `false` otherwise.
 */
async function login(credentials: LoginCredentials): Promise<void> {
    try {
        await apiClient.post('/auth/login', credentials);
    } catch (error) {
        // A response means the server rejected it (401 = bad credentials);
        // no response means a network/transport failure.
        if (isAxiosError(error) && error.response) {
            throw new LoginError(error.response.status === 401);
        }
        throw new LoginError(false);
    }
}

/**
 * TanStack Query mutation for signing in. Wraps the `login` request above; the
 * thrown error is a {@link LoginError}, so callers can branch on
 * `error.invalidCredentials`. Navigation/UI is left to the caller via
 * `mutate(credentials, { onSuccess })`.
 */
export function useLoginMutation() {
    return useMutation<void, LoginError, LoginCredentials>({
        mutationFn: login
    });
}
