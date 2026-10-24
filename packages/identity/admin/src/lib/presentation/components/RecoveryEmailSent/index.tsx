import { defineMessages, useIntl } from 'react-intl';
import { AuthCard } from '../AuthCard';
import { AuthCallout } from '../AuthCallout';
import { BackToSignIn } from '../BackToSignIn';
import { MailCheckIcon } from '../AuthIcons';

/** Intl descriptors for {@link RecoveryEmailSent}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.forgotPassword.sent.title',
        defaultMessage: 'Check your email'
    },
    description: {
        id: 'identity.forgotPassword.sent.description',
        defaultMessage:
            'If {email} belongs to an account here, a link to choose a new password is on its way. It works once, and only for a limited time.'
    },
    nothingArrived: {
        id: 'identity.forgotPassword.sent.nothingArrived',
        defaultMessage:
            'Nothing after a few minutes? Check your spam folder, or ask an admin for a reset link.'
    }
});

/** Props for {@link RecoveryEmailSent}. */
type RecoveryEmailSentProps = {
    /** The address the person typed — echoed back, never confirmed. */
    email: string;
};

/**
 * What the "Forgot it?" form says once a request is accepted — and it says
 * exactly this for **every** address. The server answers before it looks the
 * address up, so the only honest sentence is the conditional one ("if it
 * belongs to an account here"): a firmer "we've sent you a link" would be a lie
 * for an unknown address, and a different screen for one would tell a stranger
 * which addresses hold accounts.
 */
export function RecoveryEmailSent({ email }: RecoveryEmailSentProps) {
    const intl = useIntl();
    return (
        <AuthCard
            icon={<MailCheckIcon />}
            tone="success"
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description, {
                email: <b className="font-medium text-foreground">{email}</b>
            })}
        >
            <AuthCallout>
                {intl.formatMessage(messages.nothingArrived)}
            </AuthCallout>
            <BackToSignIn wording="back" />
        </AuthCard>
    );
}
