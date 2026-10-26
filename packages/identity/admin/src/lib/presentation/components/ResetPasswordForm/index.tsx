import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import { Button, Spinner, cn } from '@orthacms/design-system';
import type { PasswordResetDetails } from '../../../../types/auth';
import { AuthAlert } from '../AuthAlert';
import { AuthCallout } from '../AuthCallout';
import { AuthCard } from '../AuthCard';
import { PasswordField } from '../PasswordField';
import { useResetPasswordSchema } from './useResetPasswordSchema';

/** Intl descriptors for {@link ResetPasswordForm}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.resetPassword.title',
        defaultMessage: 'Choose a new password'
    },
    forAccount: {
        id: 'identity.resetPassword.forAccount',
        defaultMessage: 'for {email}'
    },
    passwordLabel: {
        id: 'identity.resetPassword.passwordLabel',
        defaultMessage: 'New password'
    },
    submit: {
        id: 'identity.resetPassword.submit',
        defaultMessage: 'Set new password'
    },
    submitting: {
        id: 'identity.resetPassword.submitting',
        defaultMessage: 'Setting your new password…'
    },
    signOutNote: {
        id: 'identity.resetPassword.signOutNote',
        defaultMessage: 'You’ll be signed out on every other device.'
    },
    errorTitle: {
        id: 'identity.resetPassword.errorTitle',
        defaultMessage: 'Couldn’t set your new password'
    }
});

/** The values {@link ResetPasswordForm} submits once the schema passes. */
export type ResetPasswordFormValues = {
    /** The chosen password. */
    password: string;
};

/** Props for the {@link ResetPasswordForm} component. */
type ResetPasswordFormProps = Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
    /** Which account the link resets; named, never collected. */
    reset: PasswordResetDetails;
    /** Called when the form is submitted with valid values. */
    onSubmit?: (values: ResetPasswordFormValues) => void;
    /** Whether a submission is in flight; swaps the button for a spinner. */
    isPending?: boolean;
    /** Error message to surface in the destructive alert, if any. */
    error?: string;
};

/**
 * The form someone completes to set a new password from a reset link (R7):
 * the account it is for under the heading, **one** password field with a
 * strength meter and a show/hide toggle, and the consequence — every other
 * device is signed out (identity:I-06) — said *before* the button, where it
 * can still change someone's mind, rather than after.
 *
 * Presentation only: TanStack Form holds the field, `onSubmit` is the page's.
 *
 * The address is named, not editable: which account is reset is decided by
 * the token, and a reset link arrives out-of-band, so seeing whose account it
 * opens is the one check the person following it can make. It also rides along
 * in a hidden `username` field, so a password manager saves the new password
 * against the right account.
 */
export function ResetPasswordForm({
    className,
    reset,
    onSubmit,
    isPending = false,
    error,
    ...props
}: ResetPasswordFormProps) {
    const intl = useIntl();
    const resetPasswordSchema = useResetPasswordSchema();

    const form = useForm({
        defaultValues: { password: '' },
        // `onChange` validates as the user types and also runs on submit.
        // Don't also set `onSubmit` to the same schema — the error would
        // render twice.
        validators: { onChange: resetPasswordSchema },
        onSubmit: ({ value }) => onSubmit?.(value)
    });

    return (
        <div className={cn('flex flex-col', className)} {...props}>
            <AuthCard
                title={intl.formatMessage(messages.title)}
                description={intl.formatMessage(messages.forAccount, {
                    email: reset.email
                })}
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
                    {/* For password managers only: which account the new
                        password belongs to. `hidden`, so it is neither seen,
                        focused nor announced. */}
                    <input
                        type="email"
                        name="username"
                        autoComplete="username"
                        value={reset.email}
                        readOnly
                        hidden
                    />
                    <form.Field name="password">
                        {(field) => {
                            const invalid =
                                field.state.meta.isTouched &&
                                field.state.meta.errors.length > 0;
                            return (
                                <PasswordField
                                    id="reset-password-password"
                                    name={field.name}
                                    label={intl.formatMessage(
                                        messages.passwordLabel
                                    )}
                                    autoComplete="new-password"
                                    meter
                                    value={field.state.value}
                                    onChange={field.handleChange}
                                    onBlur={field.handleBlur}
                                    errors={
                                        invalid
                                            ? field.state.meta.errors
                                            : undefined
                                    }
                                />
                            );
                        }}
                    </form.Field>
                    <AuthCallout>
                        {intl.formatMessage(messages.signOutNote)}
                    </AuthCallout>
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
            </AuthCard>
        </div>
    );
}
