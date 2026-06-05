import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { LoginPage } from '.';
import type { LoginCredentials } from '../../../types/auth.type';
import { login, LoginError } from '../../api/auth';

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
 * Route container for the sign-in page. Owns the submission seam: calls
 * `POST /api/auth/login`, drives the page's `isPending`/`error` props, and on
 * success navigates to the home page (`/`). The session lives in the `httpOnly`
 * cookie the server sets, so there is nothing to persist client-side here.
 */
export function SignInRoute() {
    const intl = useIntl();
    const navigate = useNavigate();
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string>();

    const handleSubmit = async (credentials: LoginCredentials) => {
        setIsPending(true);
        setError(undefined);
        try {
            await login(credentials);
            navigate('/', { replace: true });
        } catch (err) {
            const invalid = err instanceof LoginError && err.invalidCredentials;
            setError(
                intl.formatMessage(
                    invalid ? messages.invalidCredentials : messages.generic
                )
            );
            setIsPending(false);
        }
    };

    return (
        <LoginPage
            onSubmit={handleSubmit}
            isPending={isPending}
            error={error}
        />
    );
}
