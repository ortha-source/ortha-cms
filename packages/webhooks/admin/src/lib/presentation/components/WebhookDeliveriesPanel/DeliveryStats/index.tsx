import { defineMessages, useIntl } from 'react-intl';
import { Skeleton } from '@orthacms/design-system';
import { useWebhookDeliveries } from '../../../../application/useWebhookDeliveries';
import {
    deliveryOutcome,
    medianDuration,
    successRate
} from '../../../../domain/webhookHealth';
import { useFormatSince } from '../../../hooks/useFormatSince';

/** How many recent deliveries the figures are taken over. */
export const STATS_WINDOW = 50;

const messages = defineMessages({
    rate: {
        id: 'webhooks.stats.rate',
        defaultMessage: 'Succeeded, last {count, number}'
    },
    delivered: { id: 'webhooks.stats.delivered', defaultMessage: 'Delivered' },
    failed: { id: 'webhooks.stats.failed', defaultMessage: 'Failed' },
    median: {
        id: 'webhooks.stats.median',
        defaultMessage: 'Median response'
    },
    last: { id: 'webhooks.stats.last', defaultMessage: 'Last delivery' },
    percent: {
        id: 'webhooks.stats.percent',
        defaultMessage: '{value, number}%'
    },
    ms: { id: 'webhooks.stats.ms', defaultMessage: '{value, number} ms' },
    never: { id: 'webhooks.stats.never', defaultMessage: 'Never' }
});

/**
 * The figures over the delivery log, taken over the last {@link STATS_WINDOW}
 * deliveries — the window is in the label, so "98%" never passes for an
 * all-time number it is not.
 */
export function DeliveryStats({ endpointId }: { endpointId: string }) {
    const intl = useIntl();
    const since = useFormatSince();
    const { data, isPending } = useWebhookDeliveries(endpointId, {
        page: 1,
        pageSize: STATS_WINDOW
    });
    const items = data?.items ?? [];
    const rate = successRate(items);
    const median = medianDuration(items);
    const count = (outcome: 'ok' | 'failed') =>
        items.filter((delivery) => deliveryOutcome(delivery.status) === outcome)
            .length;

    const stats = [
        {
            key: 'rate',
            label: intl.formatMessage(messages.rate, {
                count: Math.min(STATS_WINDOW, data?.total ?? STATS_WINDOW)
            }),
            value:
                rate === null
                    ? '—'
                    : intl.formatMessage(messages.percent, { value: rate })
        },
        {
            key: 'delivered',
            label: intl.formatMessage(messages.delivered),
            value: intl.formatNumber(count('ok'))
        },
        {
            key: 'failed',
            label: intl.formatMessage(messages.failed),
            value: intl.formatNumber(count('failed'))
        },
        {
            key: 'median',
            label: intl.formatMessage(messages.median),
            value:
                median === null
                    ? '—'
                    : intl.formatMessage(messages.ms, { value: median })
        },
        {
            key: 'last',
            label: intl.formatMessage(messages.last),
            value: items[0]
                ? since(items[0].createdAt)
                : intl.formatMessage(messages.never)
        }
    ];

    return (
        <dl className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border sm:grid-cols-5 sm:divide-x">
            {stats.map((stat) => (
                <div key={stat.key} className="flex flex-col gap-1 px-4 py-3">
                    <dt className="text-xs font-medium text-muted-foreground">
                        {stat.label}
                    </dt>
                    <dd className="text-[22px] font-semibold leading-7 tabular-nums">
                        {isPending ? (
                            <Skeleton className="h-7 w-16" />
                        ) : (
                            stat.value
                        )}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
