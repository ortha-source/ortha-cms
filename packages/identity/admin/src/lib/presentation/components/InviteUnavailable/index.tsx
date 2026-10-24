import { defineMessages, useIntl } from 'react-intl';
import { AuthCard } from '../AuthCard';
import { BackToSignIn } from '../BackToSignIn';
import { ClockIcon } from '../AuthIcons';

/** Intl descriptors for {@link InviteUnavailable}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.acceptInvite.unavailable.title',
        defaultMessage: 'This invite has expired'
    },
    description: {
        id: 'identity.acceptInvite.unavailable.description',
        defaultMessage:
            'Invites work once, and only for a limited time. Ask whoever invited you to send a new one — the old link can’t be renewed. Already set your password? Sign in instead.'
    }
});

/**
 * The accept-invite screen's dead-link state: the server would not honour the
 * token. It answers one generic `404` for unknown, expired, already-accepted
 * and revoked alike (identity:I-04), so this says what is true of all four —
 * an invite works once and for a limited time — and the one action that
 * always helps.
 *
 * **It names nobody.** The board drew "Ask Ada Lovelace to send a new one";
 * this says "whoever invited you". The page is public and the link is dead, so
 * whoever holds it may well not be the invitee — a stale link from a forwarded
 * email or a log must not hand them an administrator's name.
 */
export function InviteUnavailable() {
    const intl = useIntl();
    return (
        <AuthCard
            icon={<ClockIcon />}
            tone="warning"
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <BackToSignIn />
        </AuthCard>
    );
}
