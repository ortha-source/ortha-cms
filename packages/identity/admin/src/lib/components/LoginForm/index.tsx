import { useForm } from '@tanstack/react-form';
import { useIntl } from 'react-intl';
import {
    Alert,
    AlertTitle,
    AlertDescription,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    cn
} from '@ortha-cms/design-system';
import { messages } from '../../messages';
import type { LoginCredentials } from '../../../types/auth.type';

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

    const form = useForm({
        defaultValues: { email: '', password: '' },
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
                        onSubmit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            form.handleSubmit();
                        }}
                    >
                        <FieldGroup>
                            {error && (
                                <Alert variant="destructive">
                                    <AlertTitle>
                                        {intl.formatMessage(
                                            messages.authFailedTitle
                                        )}
                                    </AlertTitle>
                                    <AlertDescription>
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <form.Field name="email">
                                {(field) => (
                                    <Field>
                                        <FieldLabel htmlFor="login-email">
                                            {intl.formatMessage(
                                                messages.emailLabel
                                            )}
                                        </FieldLabel>
                                        <Input
                                            id="login-email"
                                            type="email"
                                            placeholder={intl.formatMessage(
                                                messages.emailPlaceholder
                                            )}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            required
                                        />
                                    </Field>
                                )}
                            </form.Field>

                            <form.Field name="password">
                                {(field) => (
                                    <Field>
                                        <div className="flex items-center">
                                            <FieldLabel htmlFor="login-password">
                                                {intl.formatMessage(
                                                    messages.passwordLabel
                                                )}
                                            </FieldLabel>
                                            <a
                                                href="#"
                                                className="ml-auto text-sm underline-offset-4 hover:underline"
                                            >
                                                {intl.formatMessage(
                                                    messages.forgotPassword
                                                )}
                                            </a>
                                        </div>
                                        <Input
                                            id="login-password"
                                            type="password"
                                            placeholder={intl.formatMessage(
                                                messages.passwordPlaceholder
                                            )}
                                            value={field.state.value}
                                            onChange={(e) =>
                                                field.handleChange(
                                                    e.target.value
                                                )
                                            }
                                            onBlur={field.handleBlur}
                                            required
                                        />
                                    </Field>
                                )}
                            </form.Field>

                            <Field>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    disabled={isPending}
                                >
                                    {isPending
                                        ? intl.formatMessage(
                                              messages.loginButtonPending
                                          )
                                        : intl.formatMessage(
                                              messages.loginButton
                                          )}
                                </Button>
                                <FieldDescription className="text-center">
                                    {intl.formatMessage(messages.noAccount, {
                                        signUpLink: (
                                            <a key="signup" href="#">
                                                {intl.formatMessage(
                                                    messages.signUp
                                                )}
                                            </a>
                                        )
                                    })}
                                </FieldDescription>
                            </Field>
                        </FieldGroup>
                    </form>
                </CardContent>
            </Card>
            <FieldDescription className="px-6 text-center">
                {intl.formatMessage(messages.legalFooter, {
                    termsLink: (
                        <a key="terms" href="#">
                            {intl.formatMessage(messages.termsOfService)}
                        </a>
                    ),
                    privacyLink: (
                        <a key="privacy" href="#">
                            {intl.formatMessage(messages.privacyPolicy)}
                        </a>
                    )
                })}
            </FieldDescription>
        </div>
    );
}
