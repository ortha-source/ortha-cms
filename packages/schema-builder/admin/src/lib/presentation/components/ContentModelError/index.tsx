import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertDescription, Button } from '@orthacms/design-system';

const messages = defineMessages({
    error: {
        id: 'schemaBuilder.error.message',
        defaultMessage: 'Couldn’t load the content model. Please try again.'
    },
    retry: { id: 'schemaBuilder.error.retry', defaultMessage: 'Retry' }
});

/**
 * A failed load, as its own state — never an empty rail, which would read as
 * "this app has no content types" and mean the opposite.
 */
export function ContentModelError({ onRetry }: { onRetry: () => void }) {
    const intl = useIntl();
    return (
        <Alert variant="destructive" role="alert" className="mt-6">
            <AlertDescription className="flex items-center justify-between gap-4">
                {intl.formatMessage(messages.error)}
                <Button size="sm" variant="outline" onClick={onRetry}>
                    {intl.formatMessage(messages.retry)}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
