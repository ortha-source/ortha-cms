import { defineMessages, useIntl } from 'react-intl';
import { ShieldAlert } from 'lucide-react';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.noAccess.title',
        defaultMessage: 'You don’t have access to the content model'
    },
    description: {
        id: 'schemaBuilder.noAccess.description',
        defaultMessage:
            'Ask an administrator for the “content:read” permission.'
    }
});

/** Shown when the signed-in user lacks `content:read`; no request is sent. */
export function ContentModelNoAccess() {
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
