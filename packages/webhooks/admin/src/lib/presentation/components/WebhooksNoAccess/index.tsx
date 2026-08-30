import { defineMessages, useIntl } from 'react-intl';
import { ShieldAlert } from 'lucide-react';

const messages = defineMessages({
    title: {
        id: 'webhooks.noAccess.title',
        defaultMessage: 'You don’t have access to webhooks'
    },
    description: {
        id: 'webhooks.noAccess.description',
        defaultMessage:
            'Ask an administrator for the “webhooks:read” permission. Webhooks reach across every workspace and hold a signing secret, so both viewing and managing them are administrator-only.'
    }
});

/** Shown when the signed-in user lacks `webhooks:read`. */
export function WebhooksNoAccess() {
    const intl = useIntl();
    return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <ShieldAlert
                className="size-10 text-muted-foreground"
                aria-hidden
            />
            <h2 className="text-lg font-medium">
                {intl.formatMessage(messages.title)}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                {intl.formatMessage(messages.description)}
            </p>
        </div>
    );
}
