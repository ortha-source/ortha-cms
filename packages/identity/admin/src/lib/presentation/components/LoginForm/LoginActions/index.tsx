import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Field,
    FieldDescription,
    Spinner
} from '@ortha-cms/design-system';

/** Intl descriptors for {@link LoginActions}, co-located with the component. */
const messages = defineMessages({
    loginButton: {
        id: 'identity.login.button',
        defaultMessage: 'Login'
    },
    loginButtonPending: {
        id: 'identity.login.buttonPending',
        defaultMessage: 'Signing in…'
    },
    noAccount: {
        id: 'identity.login.noAccount',
        defaultMessage: "Don't have an account? <signup>Sign up</signup>"
    }
});

/**
 * Props for {@link LoginActions}.
 */
type LoginActionsProps = {
    /**
     * Whether a submission is in flight; the button shows a spinner and is
     * disabled. The button is **not** disabled for an empty/invalid form —
     * submitting an invalid form surfaces the field errors instead.
     */
    isPending: boolean;
};

/**
 * Submit button (a spinner replaces the label while submitting) followed by the
 * sign-up prompt. The extra `gap-5` widens the spacing between the button and
 * the prompt below it.
 */
export function LoginActions({ isPending }: LoginActionsProps) {
    const intl = useIntl();

    return (
        <Field className="gap-5">
            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                    <>
                        <Spinner aria-hidden="true" />
                        <span className="sr-only">
                            {intl.formatMessage(messages.loginButtonPending)}
                        </span>
                    </>
                ) : (
                    intl.formatMessage(messages.loginButton)
                )}
            </Button>
            <FieldDescription className="text-center">
                {intl.formatMessage(messages.noAccount, {
                    // TODO(#8): wire to the real sign-up route
                    signup: (chunks) => (
                        <button
                            type="button"
                            key="signup"
                            className="cursor-pointer underline underline-offset-4 hover:text-primary"
                        >
                            {chunks}
                        </button>
                    )
                })}
            </FieldDescription>
        </Field>
    );
}
