import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { AuthLayout } from '../../components/AuthLayout';
import { LoginForm } from '../../components/LoginForm';
import type { LoginCredentials } from '../../../types/auth.type';
import { useLoginMutation } from '../../api/useLoginMutation';

/** Intl descriptors for {@link LoginPage}, co-located with the component. */
const messages = defineMessages({
    invalidCredentials: {
        id: 'identity.login.error.invalidCredentials',
        defaultMessage: 'Invalid email or password.'
    },
    generic: {
        id: 'identity.login.error.generic',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/**
 * Login page — the route container the identity router mounts at
 * `/identity/signin`. Runs `useLoginMutation` (`POST /api/auth/login`), maps its
 * `isPending`/`error` onto the presentational {@link LoginForm}, and navigates
 * to the home page (`/`) on success. The session lives in the `httpOnly` cookie
 * the server sets, so there is nothing to persist client-side here.
 */
export function LoginPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const { mutate, isPending, error } = useLoginMutation();

    const handleSubmit = (credentials: LoginCredentials) => {
        mutate(credentials, {
            onSuccess: () => navigate('/', { replace: true })
        });
    };

    const errorMessage = error
        ? intl.formatMessage(
              error.invalidCredentials
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
