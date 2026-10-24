import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@orthacms/design-system';
import { AuthCard } from '../AuthCard';
import { BackToSignIn } from '../BackToSignIn';
import { ClockIcon } from '../AuthIcons';

/** Intl descriptors for {@link ResetLinkUnavailable}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.resetPassword.unavailable.title',
        defaultMessage: 'This reset link has expired'
    },
    description: {
        id: 'identity.resetPassword.unavailable.description',
        defaultMessage:
            'Reset links work once, and only for a limited time — and a newer one replaces the last. Already chose a new password? Sign in with it.'
    },
    requestNew: {
        id: 'identity.resetPassword.unavailable.requestNew',
        defaultMessage: 'Get a new link'
    }
});

/**
 * The reset screen's dead-link state: the server would not honour the token
 * (one generic `404` for unknown, expired, used, superseded or issued for an
 * account that is no longer active — identity:I-04). It says what is true of
 * all of them and offers the next step: "Get a new link" goes to the "Forgot
 * it?" screen, which either sends one or says who can make one.
 */
export function ResetLinkUnavailable() {
    const intl = useIntl();
    return (
        <AuthCard
            icon={<ClockIcon />}
            tone="warning"
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <Button asChild className="h-9 w-full">
                <Link to="/identity/forgot-password">
                    {intl.formatMessage(messages.requestNew)}
                </Link>
            </Button>
            <BackToSignIn />
        </AuthCard>
    );
}
