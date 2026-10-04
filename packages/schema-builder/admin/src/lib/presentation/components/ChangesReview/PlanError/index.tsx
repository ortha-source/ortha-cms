import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertDescription, Button } from '@orthacms/design-system';
import { ApiError } from '@orthacms/utils-admin';

const messages = defineMessages({
    stale: {
        id: 'schemaBuilder.planError.stale',
        defaultMessage:
            'The content model changed since this page loaded. Reload it — your draft will be lost.'
    },
    other: {
        id: 'schemaBuilder.planError.other',
        defaultMessage: 'The changes could not be checked: {message}'
    },
    reload: { id: 'schemaBuilder.planError.reload', defaultMessage: 'Reload' },
    retry: { id: 'schemaBuilder.planError.retry', defaultMessage: 'Try again' }
});

type Props = { error: unknown; onRetry: () => void };

/** A plan that failed: stale (reload) or anything else (the server's sentence, and a retry). */
export function PlanError({ error, onRetry }: Props) {
    const intl = useIntl();
    const stale = error instanceof ApiError && error.status === 409;
    return (
        <Alert variant="destructive" role="alert" className="my-3">
            <AlertDescription className="flex flex-col gap-2">
                {stale
                    ? intl.formatMessage(messages.stale)
                    : intl.formatMessage(messages.other, {
                          message: (error as Error)?.message ?? ''
                      })}
                <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={stale ? () => window.location.reload() : onRetry}
                >
                    {intl.formatMessage(
                        stale ? messages.reload : messages.retry
                    )}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
