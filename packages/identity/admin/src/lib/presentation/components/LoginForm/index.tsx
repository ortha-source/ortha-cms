import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { LoginCredentials } from '../../../../types/auth';
import { useLoginSchema } from './useLoginSchema';
import { AuthField } from '../AuthField';
import { AuthAlert } from '../AuthAlert';
import { AuthCard } from '../AuthCard';
import { AuthNotice } from '../AuthNotice';
import { PasswordField } from '../PasswordField';
import { LoginActions } from './LoginActions';
import { SsoProviders } from '../SsoProviders';

/** Intl descriptors for {@link LoginForm}, co-located with the component. */
const messages = defineMessages({
    authFailedTitle: {
        id: 'identity.login.authFailedTitle',
        defaultMessage: 'Couldn’t sign you in'
    },
    loginTitle: {
        id: 'identity.login.title',
        defaultMessage: 'Sign in'
    },
    loginDescription: {
        id: 'identity.login.description',
        defaultMessage: 'to {product} · {host}'
    },
    emailLabel: {
        id: 'identity.login.emailLabel',
        defaultMessage: 'Email'
    },
    emailPlaceholder: {
        id: 'identity.login.emailPlaceholder',
        defaultMessage: 'you@example.com'
    },
    passwordLabel: {
        id: 'identity.login.passwordLabel',
        defaultMessage: 'Password'
    },
    forgotPassword: {
        id: 'identity.login.forgotPassword',
        defaultMessage: 'Forgot it?'
    }
});

/** How the product names itself on the sign-in card. */
const PRODUCT_NAME = 'Ortha CMS';

/**
 * Props for the {@link LoginForm} component. The native `div` `onSubmit` is
 * omitted so the prop can carry the typed login credentials instead.
 */
type LoginFormProps = Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
    /** Called when the form is submitted with valid field values. */
    onSubmit?: (credentials: LoginCredentials) => void;
    /** Whether a submission is in flight; disables the button and swaps its label. */
    isPending?: boolean;
    /**
     * A failure that is not about what was typed — a throttled attempt, a
     * sign-in through a provider that did not complete, an outage. Shown as
     * the banner at the top of the card, which takes focus.
     */
    error?: string;
    /**
     * The wrong-credentials answer, said **at the password field** rather than
     * in a banner: that is the field the person goes back to. One message for
     * an unknown address and a wrong password alike (identity:I-03), so the
     * field is the same either way.
     */
    credentialsError?: string;
    /**
     * Called whenever either field changes, so the page can drop a stale
     * answer instead of leaving "don't match" under a password that has since
     * been retyped.
     */
    onEdit?: () => void;
    /**
     * A standing explanation of how the visitor got here — today, that the
     * session they were using ended underneath them. Unlike {@link error} it is
     * not a failure of anything they just did, so it neither takes focus nor
     * renders as destructive; it opens the card, above the heading.
     */
    notice?: string;
    /**
     * Where a successful sign-in should land — the location the gate was aiming
     * at. Only the single-sign-on links need it: the password form posts and
     * the page navigates afterwards, while an SSO link leaves this page
     * entirely and has to carry the destination with it.
     */
    redirectTo?: string;
    /**
     * The host the person is signing in to, shown under the heading so they
     * can see which deployment this is before typing a password into it.
     * Defaults to the page's own host.
     */
    host?: string;
};

/**
 * The sign-in card (R7): single sign-on first when the deployment has it, then
 * email and password, with "Forgot it?" on the password's label row and how
 * accounts come about underneath.
 *
 * Presentation only: field state is TanStack Form's, submission is delegated
 * to `onSubmit`, and `isPending` / `error` / `credentialsError` drive the
 * button, the banner and the password field's error. No API call lives here.
 *
 * Errors sit where they are about: a wrong password is said under the
 * password field (which then takes focus, so the person is standing where they
 * need to type), anything else in the banner at the top of the card. Neither
 * says whether the address has an account, and neither counts the tries left —
 * the throttle is keyed on the device, and a countdown would be one more thing
 * to read off a public page.
 */
export function LoginForm({
    className,
    onSubmit,
    isPending = false,
    error,
    credentialsError,
    onEdit,
    notice,
    redirectTo,
    host,
    ...props
}: LoginFormProps) {
    const intl = useIntl();
    const loginSchema = useLoginSchema();
    const passwordRef = useRef<HTMLInputElement>(null);

    const form = useForm({
        defaultValues: { email: '', password: '' },
        // `onChange` validates as the user types and **also runs on submit**
        // (TanStack's submit pass includes the change validator), so an empty
        // form flags its required fields when Sign in is pressed. Don't also
        // set `onSubmit` to the same schema — both would run on submit and
        // each field would show its error twice.
        validators: { onChange: loginSchema },
        onSubmit: ({ value }) => onSubmit?.(value)
    });

    // Put the person back on the field the answer is about. The message is the
    // field's `role="alert"` error and its description, so it is announced
    // both as it appears and on arriving at the field.
    useEffect(() => {
        if (credentialsError) passwordRef.current?.focus();
    }, [credentialsError]);

    const shownHost =
        host ?? (typeof window === 'undefined' ? '' : window.location.host);

    return (
        <div className={cn('flex flex-col', className)} {...props}>
            <AuthCard
                title={intl.formatMessage(messages.loginTitle)}
                description={
                    shownHost
                        ? intl.formatMessage(messages.loginDescription, {
                              product: PRODUCT_NAME,
                              host: shownHost
                          })
                        : undefined
                }
                // Above the heading, and never focused: the notice explains
                // why the page changed under the visitor, which is context for
                // the whole screen. AuthLayout has already put focus on the
                // heading, so stealing it here would fight the arrival.
                lead={notice ? <AuthNotice message={notice} /> : undefined}
            >
                {/* Mounted only when there is a message: AuthAlert takes focus
                    as it appears, so it must not sit mounted-and-empty. */}
                {error && (
                    <AuthAlert
                        title={intl.formatMessage(messages.authFailedTitle)}
                        message={error}
                    />
                )}

                {/* Single sign-on leads; renders nothing when the deployment
                    registers no provider, so the password form is then the
                    whole card. */}
                <SsoProviders redirectTo={redirectTo} />

                <form
                    noValidate
                    className="flex flex-col gap-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        form.handleSubmit();
                    }}
                    onChange={onEdit}
                >
                    <form.Field name="email">
                        {(field) => (
                            <AuthField
                                field={field}
                                id="login-email"
                                type="email"
                                autoComplete="email"
                                label={intl.formatMessage(messages.emailLabel)}
                                placeholder={intl.formatMessage(
                                    messages.emailPlaceholder
                                )}
                            />
                        )}
                    </form.Field>

                    <form.Field name="password">
                        {(field) => {
                            const invalid =
                                field.state.meta.isTouched &&
                                field.state.meta.errors.length > 0;
                            return (
                                <PasswordField
                                    id="login-password"
                                    name={field.name}
                                    inputRef={passwordRef}
                                    label={intl.formatMessage(
                                        messages.passwordLabel
                                    )}
                                    autoComplete="current-password"
                                    value={field.state.value}
                                    onChange={field.handleChange}
                                    onBlur={field.handleBlur}
                                    errors={
                                        invalid
                                            ? field.state.meta.errors
                                            : undefined
                                    }
                                    error={credentialsError}
                                    labelAction={
                                        <Link
                                            to="/identity/forgot-password"
                                            className="ml-auto text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                                        >
                                            {intl.formatMessage(
                                                messages.forgotPassword
                                            )}
                                        </Link>
                                    }
                                />
                            );
                        }}
                    </form.Field>

                    <LoginActions isPending={isPending} />
                </form>
            </AuthCard>
        </div>
    );
}
