import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { defineMessages, useIntl } from 'react-intl';
import { HTTP_STATUS } from '@ortha-cms/utils-admin';
import { AuthLayout } from '../../components/AuthLayout';
import { LoginForm } from '../../components/LoginForm';
import type { LoginCredentials } from '../../../../types/auth';
import { useLoginMutation } from '../../../application/useLoginMutation';
import { currentUserKey } from '../../../application/useCurrentUser';

/** Router state `RequireAuth` attaches when it bounces a user to sign-in. */
type FromState = { from?: { pathname?: string } };

/** Intl descriptors for {@link LoginPage}, co-located with the component. */
const messages = defineMessages({
    invalidCredentials: {
        id: 'identity.login.error.invalidCredentials',
        defaultMessage:
            'The email or password you entered is incorrect. Please double-check your credentials and try again.'
    },
    generic: {
        id: 'identity.login.error.generic',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/**
 * Login page — the route container the identity router mounts at
 * `/identity/signin`. Runs `useLoginMutation` (`POST /api/auth/login`), maps its
 * `isPending`/`error` onto the presentational {@link LoginForm}, and on success
 * refreshes the current user (so the host's auth context flips to authenticated)
 * before navigating to wherever the user was headed — the location `RequireAuth`
 * stashed, or `/` by default. The session lives in the `httpOnly` cookie the
 * server sets, so there is nothing to persist client-side here.
 */
export function LoginPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { mutate, isPending, error } = useLoginMutation();

    const from = (location.state as FromState | null)?.from?.pathname ?? '/';

    const handleSubmit = (credentials: LoginCredentials) => {
        mutate(credentials, {
            onSuccess: async () => {
                await queryClient.invalidateQueries({
                    queryKey: currentUserKey
                });
                navigate(from, { replace: true });
            }
        });
    };

    const errorMessage = error
        ? intl.formatMessage(
              error.status === HTTP_STATUS.UNAUTHORIZED
                  ? messages.invalidCredentials
                  : messages.generic
          )
        : undefined;

    return (
        <AuthLayout>
            <LoginForm
                onSubmit={handleSubmit}
                isPending={isPending}
                error={errorMessage}
            />
        </AuthLayout>
    );
}
