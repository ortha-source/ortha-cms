import { defineMessages, useIntl } from 'react-intl';
import { Button, Field, FieldDescription } from '@ortha-cms/design-system';

/** Intl descriptors for {@link LoginActions}, co-located with the component. */
const messages = defineMessages({
    loginButton: {
        id: 'identity.login.button',
        defaultMessage: 'Login'
    },
    loginButtonPending: {
        id: 'identity.login.buttonPending',
        defaultMessage: 'Logging in...'
    },
    noAccount: {
        id: 'identity.login.noAccount',
        defaultMessage: "Don't have an account? <signup>Sign up</signup>"
    }
});

/**
 * Props for {@link LoginActions}. `canSubmit` is fed by the parent's
 * `form.Subscribe` so the button reflects live form validity.
 */
type LoginActionsProps = {
    /** Whether a submission is in flight; disables the button and swaps its label. */
    isPending: boolean;
    /** Whether the form is currently valid and submittable. */
    canSubmit: boolean;
};

/**
 * Submit button (with pending label) followed by the sign-up prompt. The extra
 * `gap-5` widens the spacing between the button and the prompt below it.
 */
export function LoginActions({ isPending, canSubmit }: LoginActionsProps) {
    const intl = useIntl();

    return (
        <Field className="gap-5">
            <Button
                type="submit"
                className="w-full"
                disabled={isPending || !canSubmit}
            >
                {isPending
                    ? intl.formatMessage(messages.loginButtonPending)
                    : intl.formatMessage(messages.loginButton)}
            </Button>
            <FieldDescription className="text-center">
                {intl.formatMessage(messages.noAccount, {
                    // TODO(#8): wire to the real sign-up route
                    signup: (chunks) => (
                        <button type="button" key="signup">
                            {chunks}
                        </button>
                    )
                })}
            </FieldDescription>
        </Field>
    );
}
