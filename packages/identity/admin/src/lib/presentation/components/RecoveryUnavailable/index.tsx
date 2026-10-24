import { defineMessages, useIntl } from 'react-intl';
import { AuthCard } from '../AuthCard';
import { AuthCallout } from '../AuthCallout';
import { BackToSignIn } from '../BackToSignIn';

/** Intl descriptors for {@link RecoveryUnavailable}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.forgotPassword.unavailable.title',
        defaultMessage: 'Forgot your password?'
    },
    description: {
        id: 'identity.forgotPassword.unavailable.description',
        defaultMessage:
            'This server doesn’t send reset emails. Ask whoever invited you, or any admin, for a reset link.'
    },
    where: {
        id: 'identity.forgotPassword.unavailable.where',
        defaultMessage:
            'Any admin can do it in a minute: Members → your name → Sessions & access → Password reset link.'
    }
});

/**
 * "Forgot it?" on a deployment that sends no mail: says **who** can help and
 * **where they click**, without naming anyone. The page is public, so it lists
 * no administrators — "whoever invited you, or any admin" is something the
 * person can act on, and a roster would be something a stranger can.
 */
export function RecoveryUnavailable() {
    const intl = useIntl();
    return (
        <AuthCard
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <AuthCallout>{intl.formatMessage(messages.where)}</AuthCallout>
            <BackToSignIn wording="back" />
        </AuthCard>
    );
}
