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
import type { LoginCredentials } from '../../../types/auth.type';
import { useLoginSchema } from './use-login-schema';
import { LoginField } from './LoginField';
import { LoginAlert } from './LoginAlert';
import { LoginActions } from './LoginActions';
import { LegalFooter } from './LegalFooter';

/** Intl descriptors for {@link LoginForm}, co-located with the component. */
const messages = defineMessages({
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
    },
    forgotPassword: {
        id: 'identity.login.forgotPassword',
        defaultMessage: 'Forgot your password?'
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
 * Login form with card wrapper, email/password fields, and legal footer.
 * Uses TanStack Form for field state. Presentation-only: submission is
 * delegated to the `onSubmit` prop, with `isPending`/`error` driving the
 * button and alert. No API call lives here.
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
        validators: { onChange: loginSchema },
        onSubmit: ({ value }) => onSubmit?.(value)
    });

    return (
        <div className={cn('flex flex-col gap-6', className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">
                        {intl.formatMessage(messages.loginTitle)}
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
                            <LoginAlert message={error} />

                            <form.Field name="email">
                                {(field) => (
                                    <LoginField
                                        field={field}
                                        id="login-email"
                                        type="email"
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
                                    <LoginField
                                        field={field}
                                        id="login-password"
                                        type="password"
                                        label={intl.formatMessage(
                                            messages.passwordLabel
                                        )}
                                        placeholder={intl.formatMessage(
                                            messages.passwordPlaceholder
                                        )}
                                        labelAction={
                                            <a
                                                href="#"
                                                className="ml-auto text-sm underline-offset-4 hover:underline"
                                            >
                                                {intl.formatMessage(
                                                    messages.forgotPassword
                                                )}
                                            </a>
                                        }
                                    />
                                )}
                            </form.Field>

                            <form.Subscribe
                                selector={(state) => state.canSubmit}
                            >
                                {(canSubmit) => (
                                    <LoginActions
                                        isPending={isPending}
                                        canSubmit={canSubmit}
                                    />
                                )}
                            </form.Subscribe>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
            <LegalFooter />
        </div>
    );
}
