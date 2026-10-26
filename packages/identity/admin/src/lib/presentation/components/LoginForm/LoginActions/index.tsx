import { defineMessages, useIntl } from 'react-intl';
import { Button, Spinner } from '@orthacms/design-system';

/** Intl descriptors for {@link LoginActions}, co-located with the component. */
const messages = defineMessages({
    loginButton: {
        id: 'identity.login.button',
        defaultMessage: 'Sign in'
    },
    loginButtonPending: {
        id: 'identity.login.buttonPending',
        defaultMessage: 'Signing in…'
    },
    inviteOnly: {
        id: 'identity.login.inviteOnly',
        defaultMessage: 'No account? Ortha is invite-only — ask an admin.'
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
 * The full-width Sign in button (a spinner replaces the label while
 * submitting) and, under it, how accounts come about.
 *
 * The note is plain text, not a "Sign up" control: there is no self-service
 * sign-up to route to, and there cannot be one — an account exists because an
 * admin invited it (`/identity/accept-invite`). It says "an admin" and names
 * nobody: this page is public, and a list of who holds the keys is the last
 * thing it should hand a stranger.
 */
export function LoginActions({ isPending }: LoginActionsProps) {
    const intl = useIntl();

    return (
        <div className="flex flex-col gap-4">
            <Button type="submit" className="h-9 w-full" disabled={isPending}>
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
            <p className="text-center text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.inviteOnly)}
            </p>
        </div>
    );
}
