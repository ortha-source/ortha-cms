import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Button, Spinner } from '@orthacms/design-system';
import { AuthCard } from '../AuthCard';

/** Intl descriptors for {@link InviteLookupFailed}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'identity.acceptInvite.lookupFailed.title',
        defaultMessage: 'We couldn’t check your invite'
    },
    description: {
        id: 'identity.acceptInvite.lookupFailed.description',
        defaultMessage:
            'Your link is probably fine — we just couldn’t reach the server to look it up.'
    },
    whatToDo: {
        id: 'identity.acceptInvite.lookupFailed.whatToDo',
        defaultMessage:
            'Try again in a moment. Keep this link: it has not been used, so it still works once we can reach the server.'
    },
    retry: {
        id: 'identity.acceptInvite.lookupFailed.retry',
        defaultMessage: 'Try again'
    },
    retrying: {
        id: 'identity.acceptInvite.lookupFailed.retrying',
        defaultMessage: 'Checking your invite…'
    },
    signIn: {
        id: 'identity.acceptInvite.lookupFailed.signIn',
        defaultMessage: 'Go to sign in'
    }
});

/** Props for {@link InviteLookupFailed}. */
type InviteLookupFailedProps = {
    /** Re-runs the invite lookup; wired to the query's `refetch`. */
    onRetry: () => void;
    /** Whether a retry is in flight; swaps the button for a spinner. */
    isRetrying?: boolean;
};

/**
 * The accept-invite screen's *outage* state: the lookup failed for a reason
 * that is not "the server refused this token" — it timed out, the network
 * dropped, or the API answered `500`.
 *
 * Kept separate from {@link InviteUnavailable} because the two are opposite
 * advice. A `404` means the link is spent and the invitee must ask for a new
 * one; anything else means the link is very likely fine and they should wait
 * and retry. Collapsing them told everyone caught by a five-minute outage to go
 * bother the person who invited them for a replacement they don't need.
 */
export function InviteLookupFailed({
    onRetry,
    isRetrying = false
}: InviteLookupFailedProps) {
    const intl = useIntl();

    return (
        <AuthCard
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.description)}
        >
            <p className="text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.whatToDo)}
            </p>
            <Button
                type="button"
                className="h-9 w-full"
                onClick={onRetry}
                disabled={isRetrying}
            >
                {isRetrying ? (
                    <>
                        <Spinner aria-hidden="true" />
                        <span className="sr-only">
                            {intl.formatMessage(messages.retrying)}
                        </span>
                    </>
                ) : (
                    intl.formatMessage(messages.retry)
                )}
            </Button>
            <Button asChild variant="outline" className="h-9 w-full">
                <Link to="/identity/signin">
                    {intl.formatMessage(messages.signIn)}
                </Link>
            </Button>
        </AuthCard>
    );
}
