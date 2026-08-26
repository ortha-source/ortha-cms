import { defineMessages, useIntl } from 'react-intl';
import { ShieldAlert } from 'lucide-react';

const messages = defineMessages({
    title: {
        id: 'segments.noAccess.title',
        defaultMessage: 'You don’t have access to segmentation'
    },
    description: {
        id: 'segments.noAccess.description',
        defaultMessage:
            'Ask an administrator for the “access:read” permission to see which readers content is restricted to.'
    }
});

/** Shown when the signed-in user lacks `access:read`. */
export function AccessNoAccess() {
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
