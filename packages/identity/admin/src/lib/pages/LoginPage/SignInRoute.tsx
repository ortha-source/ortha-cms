import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { LoginPage } from '.';
import type { LoginCredentials } from '../../../types/auth.type';
import { useLoginMutation } from '../../api/use-login-mutation';

/** Intl descriptors for {@link SignInRoute}, co-located with the component. */
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
 * Route container for the sign-in page. Owns the submission seam: runs the
 * `useLoginMutation` (`POST /api/auth/login`), maps its `isPending`/`error`
 * onto the page's props, and on success navigates to the home page (`/`). The
 * session lives in the `httpOnly` cookie the server sets, so there is nothing
 * to persist client-side here.
 */
export function SignInRoute() {
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
        <LoginPage
            onSubmit={handleSubmit}
            isPending={isPending}
            error={errorMessage}
        />
    );
}
