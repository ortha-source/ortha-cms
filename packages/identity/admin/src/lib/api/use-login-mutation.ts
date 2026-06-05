import { useMutation } from '@tanstack/react-query';
import type { LoginCredentials } from '../../types/auth.type';
import { login, LoginError } from './auth';

/**
 * TanStack Query mutation for signing in. Wraps {@link login}; on success the
 * server has set the `httpOnly` session cookie (nothing is returned). The
 * thrown error is a {@link LoginError}, so callers can branch on
 * `error.invalidCredentials`. Navigation/UI is left to the caller via
 * `mutate(credentials, { onSuccess })`.
 */
export function useLoginMutation() {
    return useMutation<void, LoginError, LoginCredentials>({
        mutationFn: login
    });
}
