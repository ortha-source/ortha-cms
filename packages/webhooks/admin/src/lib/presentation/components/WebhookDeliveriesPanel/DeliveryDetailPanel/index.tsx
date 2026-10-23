import { defineMessages, useIntl } from 'react-intl';
import { RefreshCw } from 'lucide-react';
import {
    Button,
    Spinner,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from '@orthacms/design-system';
import type { WebhookDeliveryDetail } from '../../../../domain/types/webhook';
import { DeliveryStatusBadge } from '../../DeliveryStatusBadge';

const messages = defineMessages({
    region: { id: 'webhooks.delivery.region', defaultMessage: 'Delivery' },
    summary: {
        id: 'webhooks.delivery.summary',
        defaultMessage:
            '{when} · {attempts, plural, one {attempt #} other {# attempts}}'
    },
    answered: {
        id: 'webhooks.delivery.answered',
        defaultMessage: '{code} in {ms, number} ms'
    },
    request: { id: 'webhooks.delivery.requestTab', defaultMessage: 'Request' },
    response: {
        id: 'webhooks.delivery.response',
        defaultMessage: 'Response'
    },
    noResponse: {
        id: 'webhooks.delivery.noResponse',
        defaultMessage: 'The receiver sent no body.'
    },
    error: { id: 'webhooks.delivery.error', defaultMessage: 'Error' },
    statusCode: {
        id: 'webhooks.delivery.statusCode',
        defaultMessage: 'HTTP status'
    },
    duration: { id: 'webhooks.delivery.duration', defaultMessage: 'Took' },
    durationValue: {
        id: 'webhooks.delivery.durationValue',
        defaultMessage: '{ms} ms'
    },
    nextAttempt: {
        id: 'webhooks.delivery.nextAttempt',
        defaultMessage: 'Next attempt'
    },
    eventId: {
        id: 'webhooks.delivery.eventId',
        defaultMessage: 'Event id (deduplicate on this)'
    },
    deliveryId: {
        id: 'webhooks.delivery.deliveryId',
        defaultMessage: 'Delivery id'
    },
    body: { id: 'webhooks.delivery.request', defaultMessage: 'Request body' },
    redeliver: {
        id: 'webhooks.delivery.redeliver',
        defaultMessage: 'Send again'
    },
    pick: {
        id: 'webhooks.delivery.pick',
        defaultMessage:
            'Pick a delivery to see what was sent and what came back.'
    },
    none: { id: 'webhooks.delivery.none', defaultMessage: '—' }
});

type DeliveryDetailPanelProps = {
    /** The picked delivery, `undefined` while it loads, `null` with none. */
    delivery: WebhookDeliveryDetail | undefined | null;
    /** Where it was posted — the endpoint's URL. */
    url: string;
    canRedeliver: boolean;
    redelivering: boolean;
    onRedeliver: (deliveryId: string) => void;
};

/**
 * The picked delivery, beside the log: its event and state over when it went
 * and how it was answered, then **Request** (where it was posted and the body,
 * verbatim — stored verbatim, so byte-for-byte what the receiver got) and
 * **Response** (the status, the error, what came back).
 */
export function DeliveryDetailPanel({
    delivery,
    url,
    canRedeliver,
    redelivering,
    onRedeliver
}: DeliveryDetailPanelProps) {
    const intl = useIntl();
    const none = intl.formatMessage(messages.none);

    let body;
    if (delivery === null) {
        body = (
            <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.pick)}
            </p>
        );
    } else if (!delivery) {
        body = (
            <div className="flex justify-center py-10">
                <Spinner />
            </div>
        );
    } else {
        const when = intl.formatDate(delivery.createdAt, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
        const answered =
            delivery.statusCode !== null && delivery.durationMs !== null
                ? intl.formatMessage(messages.answered, {
                      code: delivery.statusCode,
                      ms: delivery.durationMs
                  })
                : null;
        body = (
            <>
                <header className="flex items-start gap-3 border-b px-4 py-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex min-w-0 items-center gap-2">
                            <h2
                                id="webhook-delivery-title"
                                className="truncate font-mono text-sm font-semibold"
                            >
                                {delivery.eventKind}
                            </h2>
                            <DeliveryStatusBadge status={delivery.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {[
                                intl.formatMessage(messages.summary, {
                                    when,
                                    attempts: delivery.attempts
                                }),
                                answered
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                    {canRedeliver ? (
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={redelivering}
                            onClick={() => onRedeliver(delivery.id)}
                        >
                            <RefreshCw aria-hidden />
                            {intl.formatMessage(messages.redeliver)}
                        </Button>
                    ) : null}
                </header>
                <Tabs defaultValue="request" className="gap-0">
                    <TabsList className="mx-4 mt-3">
                        <TabsTrigger value="request">
                            {intl.formatMessage(messages.request)}
                        </TabsTrigger>
                        <TabsTrigger value="response">
                            {intl.formatMessage(messages.response)}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value="request"
                        className="flex flex-col gap-3 p-4"
                    >
                        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 font-mono text-xs">
                            <dt className="text-muted-foreground">POST</dt>
                            <dd className="break-all">{url}</dd>
                            <dt className="text-muted-foreground">
                                {intl.formatMessage(messages.eventId)}
                            </dt>
                            <dd className="break-all">{delivery.eventId}</dd>
                            <dt className="text-muted-foreground">
                                {intl.formatMessage(messages.deliveryId)}
                            </dt>
                            <dd className="break-all">{delivery.id}</dd>
                        </dl>
                        <h3 className="sr-only">
                            {intl.formatMessage(messages.body)}
                        </h3>
                        <pre className="max-h-[420px] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5">
                            {JSON.stringify(delivery.payload, null, 2)}
                        </pre>
                    </TabsContent>
                    <TabsContent
                        value="response"
                        className="flex flex-col gap-3 p-4"
                    >
                        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                            <dt className="text-muted-foreground">
                                {intl.formatMessage(messages.statusCode)}
                            </dt>
                            <dd className="tabular-nums">
                                {delivery.statusCode ?? none}
                            </dd>
                            <dt className="text-muted-foreground">
                                {intl.formatMessage(messages.duration)}
                            </dt>
                            <dd className="tabular-nums">
                                {delivery.durationMs === null
                                    ? none
                                    : intl.formatMessage(
                                          messages.durationValue,
                                          { ms: delivery.durationMs }
                                      )}
                            </dd>
                            {delivery.nextAttemptAt ? (
                                <>
                                    <dt className="text-muted-foreground">
                                        {intl.formatMessage(
                                            messages.nextAttempt
                                        )}
                                    </dt>
                                    <dd>
                                        {intl.formatDate(
                                            delivery.nextAttemptAt,
                                            {
                                                dateStyle: 'medium',
                                                timeStyle: 'short'
                                            }
                                        )}
                                    </dd>
                                </>
                            ) : null}
                        </dl>
                        {delivery.error ? (
                            <p className="rounded-lg bg-destructive-soft px-3 py-2 text-[13px] text-destructive-soft-foreground">
                                <span className="font-medium">
                                    {intl.formatMessage(messages.error)}:
                                </span>{' '}
                                {delivery.error}
                            </p>
                        ) : null}
                        <pre className="max-h-[320px] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
                            {delivery.responseSnippet ??
                                intl.formatMessage(messages.noResponse)}
                        </pre>
                    </TabsContent>
                </Tabs>
            </>
        );
    }

    return (
        <section
            aria-label={intl.formatMessage(messages.region)}
            className="min-w-0 self-start overflow-hidden rounded-xl border bg-card lg:sticky lg:top-6"
        >
            {body}
        </section>
    );
}
