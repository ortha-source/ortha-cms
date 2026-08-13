import { useForm } from '@tanstack/react-form';
import { defineMessages, useIntl } from 'react-intl';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    FieldGroup,
    cn
} from '@ortha-cms/design-system';
import type { LoginCredentials } from '../../../../types/auth';
import { useLoginSchema } from './useLoginSchema';
import { AuthField } from '../AuthField';
import { AuthAlert } from '../AuthAlert';
import { LoginActions } from './LoginActions';

/** Intl descriptors for {@link LoginForm}, co-located with the component. */
const messages = defineMessages({
    authFailedTitle: {
        id: 'identity.login.authFailedTitle',
        defaultMessage: 'Authentication failed'
    },
    loginTitle: {
        id: 'identity.login.title',
        defaultMessage: 'Welcome back'
    },
    loginDescription: {
        id: 'identity.login.description',
        defaultMessage: 'Login to your account to continue'
    },
    emailLabel: {
        id: 'identity.login.emailLabel',
        defaultMessage: 'Email'
    },
    emailPlaceholder: {
        id: 'identity.login.emailPlaceholder',
        defaultMessage: 'm@example.com'
    },
    passwordLabel: {
        id: 'identity.login.passwordLabel',
        defaultMessage: 'Password'
    },
    passwordPlaceholder: {
        id: 'identity.login.passwordPlaceholder',
        defaultMessage: '••••••••'
    }
});

/**
 * Props for the {@link LoginForm} component. The native `div` `onSubmit` is
 * omitted so the prop can carry the typed login credentials instead.
 */
type LoginFormProps = Omit<React.ComponentProps<'div'>, 'onSubmit'> & {
    /**
     * Called when the form is submitted with valid field values. UI-only for
     * now — the real authentication call is wired in later (#8).
     */
    onSubmit?: (credentials: LoginCredentials) => void;
    /** Whether a submission is in flight; disables the button and swaps its label. */
    isPending?: boolean;
    /** Error message to surface in the destructive alert, if any. */
    error?: string;
};

/**
 * Login form with card wrapper and email/password fields. Uses TanStack Form
 * for field state. Presentation-only: submission is delegated to the `onSubmit`
 * prop, with `isPending`/`error` driving the button and alert. No API call
 * lives here.
 *
 * Every control on the card does something. Password recovery, sign-up, and the
 * terms/privacy pages have no routes yet, so they are absent rather than
 * rendered as buttons that swallow the click — a control that announces itself
 * as operable has to be operable (WCAG 4.1.2), and a keyboard user who tabs
 * into a dead stop mid-credential-flow reasonably concludes the page is broken.
 */
export function LoginForm({
    className,
    onSubmit,
    isPending = false,
    error,
    ...props
}: LoginFormProps) {
    const intl = useIntl();
    const loginSchema = useLoginSchema();

    const form = useForm({
        defaultValues: { email: '', password: '' },
        // `onChange` validates as the user types and **also runs on submit**
        // (TanStack's submit pass includes the change validator), so an empty
        // form flags its required fields when Login is pressed. Don't also set
        // `onSubmit` to the same schema — both would run on submit and each
        // field would show its error twice.
        validators: { onChange: loginSchema },
        onSubmit: ({ value }) => onSubmit?.(value)
    });

    return (
        <div className={cn('flex flex-col gap-6', className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle asChild className="text-xl">
                        <h1>{intl.formatMessage(messages.loginTitle)}</h1>
                    </CardTitle>
                    <CardDescription>
                        {intl.formatMessage(messages.loginDescription)}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        noValidate
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                    >
                        <FieldGroup>
                            {/* Mounted only when there is a message: AuthAlert
                                takes focus as it appears, so it must not sit
                                mounted-and-empty. */}
                            {error && (
                                <AuthAlert
                                    title={intl.formatMessage(
                                        messages.authFailedTitle
                                    )}
                                    message={error}
                                />
                            )}

                            <form.Field name="email">
                                {(field) => (
                                    <AuthField
                                        field={field}
                                        id="login-email"
                                        type="email"
                                        autoComplete="email"
                                        label={intl.formatMessage(
                                            messages.emailLabel
                                        )}
                                        placeholder={intl.formatMessage(
                                            messages.emailPlaceholder
                                        )}
                                    />
                                )}
                            </form.Field>

                            <form.Field name="password">
                                {(field) => (
                                    <AuthField
                                        field={field}
                                        id="login-password"
                                        type="password"
                                        autoComplete="current-password"
                                        label={intl.formatMessage(
                                            messages.passwordLabel
                                        )}
                                        placeholder={intl.formatMessage(
                                            messages.passwordPlaceholder
                                        )}
                                    />
                                )}
                            </form.Field>

                            <LoginActions isPending={isPending} />
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
