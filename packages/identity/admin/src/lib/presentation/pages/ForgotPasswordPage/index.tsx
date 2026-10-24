import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { HTTP_STATUS, useDocumentTitle } from '@orthacms/utils-admin';
import { AuthLayout } from '../../components/AuthLayout';
import { AuthCardSkeleton } from '../../components/AuthCardSkeleton';
import { ForgotPasswordForm } from '../../components/ForgotPasswordForm';
import { RecoveryEmailSent } from '../../components/RecoveryEmailSent';
import { RecoveryUnavailable } from '../../components/RecoveryUnavailable';
import { usePasswordRecoveryAvailability } from '../../../application/usePasswordRecoveryAvailability';
import { useRequestPasswordRecoveryMutation } from '../../../application/useRequestPasswordRecoveryMutation';
import { rateLimitMessage } from '../../rateLimitMessage';

/** Intl descriptors for {@link ForgotPasswordPage}, co-located with the component. */
const messages = defineMessages({
    documentTitle: {
        id: 'identity.forgotPassword.documentTitle',
        defaultMessage: 'Forgot your password?'
    },
    loading: {
        id: 'identity.forgotPassword.loading',
        defaultMessage: 'Loading…'
    },
    invalidEmail: {
        id: 'identity.forgotPassword.error.invalidEmail',
        defaultMessage:
            'That doesn’t look like an email address. Check it and try again.'
    },
    generic: {
        id: 'identity.forgotPassword.error.generic',
        defaultMessage: 'Something went wrong. Please try again.'
    }
});

/**
 * "Forgot it?" — the route container the identity router mounts at
 * `/identity/forgot-password`. What it is depends on the deployment:
 *
 * - **No mail provider** (the default install): {@link RecoveryUnavailable},
 *   which says who can make a reset link and where they click — an admin, on
 *   the member's Sessions & access tab — without naming anyone.
 * - **A mail provider**: the request form, then {@link RecoveryEmailSent}.
 *   The confirmation is the same for every address, because the server
 *   accepted the request before looking at it (no enumeration signal).
 *
 * A failed availability probe falls back to the "ask an admin" card: it is
 * true on every deployment, and a person locked out of their account is better
 * served by something they can act on than by an outage screen.
 */
export function ForgotPasswordPage() {
    const intl = useIntl();
    const availability = usePasswordRecoveryAvailability();
    const request = useRequestPasswordRecoveryMutation();
    const [sentTo, setSentTo] = useState<string | null>(null);

    useDocumentTitle(intl.formatMessage(messages.documentTitle));

    if (availability.isPending) {
        return (
            <AuthLayout surface="forgot-loading" focusHeading={false}>
                <AuthCardSkeleton
                    heading={intl.formatMessage(messages.documentTitle)}
                    status={intl.formatMessage(messages.loading)}
                    fields={1}
                />
            </AuthLayout>
        );
    }

    // The route disappeared between the probe and the request (the operator
    // removed the provider): what is true now is the no-mail answer.
    const goneSinceProbe = request.error?.status === HTTP_STATUS.NOT_FOUND;

    if (!availability.data || goneSinceProbe) {
        return (
            <AuthLayout surface="forgot-unavailable">
                <RecoveryUnavailable />
            </AuthLayout>
        );
    }

    if (sentTo) {
        return (
            <AuthLayout surface="forgot-sent">
                <RecoveryEmailSent email={sentTo} />
            </AuthLayout>
        );
    }

    const errorMessage = request.error
        ? (rateLimitMessage(intl, request.error) ??
          intl.formatMessage(
              request.error.status === HTTP_STATUS.BAD_REQUEST
                  ? messages.invalidEmail
                  : messages.generic
          ))
        : undefined;

    return (
        <AuthLayout surface="forgot-form">
            <ForgotPasswordForm
                isPending={request.isPending}
                error={errorMessage}
                onSubmit={(email) =>
                    request.mutate(email, {
                        onSuccess: () => setSentTo(email)
                    })
                }
            />
        </AuthLayout>
    );
}
