import { useMemo } from 'react';
import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import { z } from 'zod';
import { Button, Spinner } from '@orthacms/design-system';
import { Email } from '../../../domain/value-objects/email';
import { AuthAlert } from '../AuthAlert';
import { AuthCard } from '../AuthCard';
import { AuthField } from '../AuthField';
import { BackToSignIn } from '../BackToSignIn';

/** Intl descriptors for {@link ForgotPasswordForm}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.forgotPassword.title',
        defaultMessage: 'Forgot your password?'
    },
    description: {
        id: 'identity.forgotPassword.description',
        defaultMessage:
            'Enter the email you sign in with. If it belongs to an account here, we’ll send a link to choose a new password.'
    },
    emailLabel: {
        id: 'identity.forgotPassword.emailLabel',
        defaultMessage: 'Email'
    },
    emailPlaceholder: {
        id: 'identity.forgotPassword.emailPlaceholder',
        defaultMessage: 'you@example.com'
    },
    emailRequired: {
        id: 'identity.forgotPassword.emailRequired',
        defaultMessage: 'Enter the email you sign in with'
    },
    emailInvalid: {
        id: 'identity.forgotPassword.emailInvalid',
        defaultMessage: 'Enter a valid email address'
    },
    submit: {
        id: 'identity.forgotPassword.submit',
        defaultMessage: 'Send reset link'
    },
    submitting: {
        id: 'identity.forgotPassword.submitting',
        defaultMessage: 'Sending…'
    },
    errorTitle: {
        id: 'identity.forgotPassword.errorTitle',
        defaultMessage: 'Couldn’t send the link'
    }
});

/** Props for {@link ForgotPasswordForm}. */
type ForgotPasswordFormProps = {
    /** Called with the address once it passes the format check. */
    onSubmit: (email: string) => void;
    /** Whether a request is in flight. */
    isPending?: boolean;
    /** A failure to show in the banner (throttled, outage). */
    error?: string;
};

/**
 * The request half of self-service recovery: one email field and a button,
 * on a deployment that sends mail. Presentation only — the page runs the
 * mutation and decides what each answer means.
 *
 * The description promises nothing about the address ("if it belongs to an
 * account here"), because the answer to that is exactly what this page must
 * never give.
 */
export function ForgotPasswordForm({
    onSubmit,
    isPending = false,
    error
}: ForgotPasswordFormProps) {
    const intl = useIntl();
    const schema = useMemo(
        () =>
            z.object({
                email: z
                    .string()
                    .min(1, {
                        message: intl.formatMessage(messages.emailRequired)
                    })
                    // Skipped when empty, so an empty box gets one message.
                    .refine(
                        (value) => value.length === 0 || Email.isValid(value),
                        { message: intl.formatMessage(messages.emailInvalid) }
                    )
            }),
        [intl]
    );

    const form = useForm({
        defaultValues: { email: '' },
        validators: { onChange: schema },
        onSubmit: ({ value }) => onSubmit(value.email.trim())
    });

    return (
        <AuthCard
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            {error && (
                <AuthAlert
                    title={intl.formatMessage(messages.errorTitle)}
                    message={error}
                />
            )}
            <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
            >
                <form.Field name="email">
                    {(field) => (
                        <AuthField
                            field={field}
                            id="forgot-password-email"
                            type="email"
                            autoComplete="email"
                            label={intl.formatMessage(messages.emailLabel)}
                            placeholder={intl.formatMessage(
                                messages.emailPlaceholder
                            )}
                        />
                    )}
                </form.Field>
                <Button
                    type="submit"
                    className="h-9 w-full"
                    disabled={isPending}
                >
                    {isPending ? (
                        <>
                            <Spinner aria-hidden="true" />
                            <span className="sr-only">
                                {intl.formatMessage(messages.submitting)}
                            </span>
                        </>
                    ) : (
                        intl.formatMessage(messages.submit)
                    )}
                </Button>
            </form>
            <BackToSignIn wording="back" />
        </AuthCard>
    );
}
