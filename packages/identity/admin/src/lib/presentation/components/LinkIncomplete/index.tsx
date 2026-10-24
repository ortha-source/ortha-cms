import { defineMessages, useIntl } from 'react-intl';
import { AuthCard } from '../AuthCard';
import { BackToSignIn } from '../BackToSignIn';
import { UnlinkIcon } from '../AuthIcons';

/** Intl descriptors for {@link LinkIncomplete}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.link.incomplete.title',
        defaultMessage: 'This link isn’t complete'
    },
    description: {
        id: 'identity.link.incomplete.description',
        defaultMessage:
            'Part of it may have been cut off when it was copied. Open it again from the original message, or ask for a new one.'
    }
});

/**
 * The page for an invite or reset link whose token is missing or is not the
 * shape a token has (`isCompleteLinkToken`) — almost always a long link a chat
 * app or an email client cut in two. Decided in the browser, before any
 * request: the link cannot be valid, and saying *why* it broke tells the
 * holder what to do (open it again from the original message), which a
 * generic "expired" would not.
 *
 * It names nobody and asks the server nothing, so it says nothing about any
 * account either.
 */
export function LinkIncomplete() {
    const intl = useIntl();
    return (
        <AuthCard
            icon={<UnlinkIcon />}
            tone="muted"
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <BackToSignIn />
        </AuthCard>
    );
}
