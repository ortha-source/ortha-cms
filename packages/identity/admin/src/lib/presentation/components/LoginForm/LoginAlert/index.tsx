import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertTitle, AlertDescription } from '@ortha-cms/design-system';

/** Intl descriptors for {@link LoginAlert}, co-located with the component. */
const messages = defineMessages({
    authFailedTitle: {
        id: 'identity.login.authFailedTitle',
        defaultMessage: 'Authentication failed'
    }
});

/**
 * Destructive alert surfacing an authentication error. Renders nothing when
 * there is no message to show.
 */
export function LoginAlert({ message }: { message?: string }) {
    const intl = useIntl();

    if (!message) {
        return null;
    }

    return (
        <Alert variant="destructive">
            <AlertTitle>
                {intl.formatMessage(messages.authFailedTitle)}
            </AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}
