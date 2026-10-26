import { defineMessages, useIntl } from 'react-intl';
import { AuthCard } from '../AuthCard';
import { BackToSignIn } from '../BackToSignIn';
import { CheckIcon } from '../AuthIcons';

/** Intl descriptors for {@link PasswordResetDone}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.resetPassword.done.title',
        defaultMessage: 'Your password is set'
    },
    description: {
        id: 'identity.resetPassword.done.description',
        defaultMessage: 'Sign in with it now. Other devices were signed out.'
    }
});

/**
 * The reset screen's success state. The redemption deliberately issues no
 * session — the person proved only that they hold a link — so this hands off
 * to the sign-in form rather than redirecting into the app, and says so.
 *
 * It also names the consequence they did not choose: every other session on
 * the account was revoked (identity:I-06). Someone whose account was reset
 * without asking needs to hear that now, not discover it as a mystery
 * sign-out later.
 */
export function PasswordResetDone() {
    const intl = useIntl();
    return (
        <AuthCard
            icon={<CheckIcon />}
            tone="success"
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <BackToSignIn variant="primary" />
        </AuthCard>
    );
}
