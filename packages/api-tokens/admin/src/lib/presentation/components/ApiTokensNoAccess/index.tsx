import { defineMessages, useIntl } from 'react-intl';
import { ShieldAlert } from 'lucide-react';

const messages = defineMessages({
    title: {
        id: 'apiTokens.noAccess.title',
        defaultMessage: 'You don’t have access to API tokens'
    },
    description: {
        id: 'apiTokens.noAccess.description',
        defaultMessage:
            'Ask an administrator for the “tokens:read” permission to view and manage API tokens.'
    }
});

/** Shown when the signed-in user lacks `tokens:read`. */
export function ApiTokensNoAccess() {
    const intl = useIntl();
    return (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <ShieldAlert className="size-10 text-muted-foreground" aria-hidden />
            <h2 className="text-lg font-medium">
                {intl.formatMessage(messages.title)}
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
                {intl.formatMessage(messages.description)}
            </p>
        </div>
    );
}
