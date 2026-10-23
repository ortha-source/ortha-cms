import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    toast
} from '@orthacms/design-system';
import { DELIVERY_STATUSES } from '../../../domain/types/webhook';
import {
    DEFAULT_PAGE_SIZE,
    useWebhookDeliveries,
    useWebhookDelivery
} from '../../../application/useWebhookDeliveries';
import { useRedeliverWebhook } from '../../../application/useWebhookMutations';
import type { WebhookDelivery } from '../../../domain/types/webhook';
import { DeliveryDetailPanel } from './DeliveryDetailPanel';
import { DeliveryRow } from './DeliveryRow';
import { DeliveryStats } from './DeliveryStats';

const messages = defineMessages({
    caption: {
        id: 'webhooks.deliveries.caption',
        defaultMessage: 'Delivery log'
    },
    empty: {
        id: 'webhooks.deliveries.empty',
        defaultMessage:
            'Nothing has been sent yet. A delivery appears here the moment content this endpoint subscribes to changes.'
    },
    error: {
        id: 'webhooks.deliveries.error',
        defaultMessage: 'Couldn’t load the delivery log. Please try again.'
    },
    retry: { id: 'webhooks.deliveries.retry', defaultMessage: 'Retry' },
    filterAll: {
        id: 'webhooks.deliveries.filterAll',
        defaultMessage: 'All states'
    },
    filterLabel: {
        id: 'webhooks.deliveries.filterLabel',
        defaultMessage: 'Filter by state'
    },
    today: { id: 'webhooks.deliveries.today', defaultMessage: 'Today' },
    yesterday: {
        id: 'webhooks.deliveries.yesterday',
        defaultMessage: 'Yesterday'
    },
    total: {
        id: 'webhooks.deliveries.total',
        defaultMessage: '{count, plural, one {# delivery} other {# deliveries}}'
    },
    prev: { id: 'webhooks.deliveries.prev', defaultMessage: 'Previous' },
    next: { id: 'webhooks.deliveries.next', defaultMessage: 'Next' },
    pageOf: {
        id: 'webhooks.deliveries.pageOf',
        defaultMessage: 'Page {page} of {pageCount}'
    },
    redelivered: {
        id: 'webhooks.deliveries.redelivered',
        defaultMessage: 'Queued to send again'
    },
    redeliverFailed: {
        id: 'webhooks.deliveries.redeliverFailed',
        defaultMessage: 'Couldn’t queue it again. Please try again.'
    },
    statusPending: {
        id: 'webhooks.status.pending',
        defaultMessage: 'Queued'
    },
    statusDelivering: {
        id: 'webhooks.status.delivering',
        defaultMessage: 'Sending'
    },
    statusSucceeded: {
        id: 'webhooks.status.succeeded',
        defaultMessage: 'Delivered'
    },
    statusFailed: { id: 'webhooks.status.failed', defaultMessage: 'Retrying' },
    statusDead: { id: 'webhooks.status.dead', defaultMessage: 'Failed' }
});

/** The filter dropdown's label for each state — same wording as the chips. */
const STATUS_LABELS = {
    pending: messages.statusPending,
    delivering: messages.statusDelivering,
    succeeded: messages.statusSucceeded,
    failed: messages.statusFailed,
    dead: messages.statusDead
} as const;

/** One day of the log, newest first as the page arrives. */
type DayGroup = {
    key: string;
    date: Date;
    today: boolean;
    yesterday: boolean;
    items: WebhookDelivery[];
};

/** Splits a page of the log into runs of one calendar day each. */
function groupByDay(deliveries: WebhookDelivery[]): DayGroup[] {
    const dayKey = (date: Date) => date.toDateString();
    const now = new Date();
    const todayKey = dayKey(now);
    const yesterdayKey = dayKey(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    );
    const groups: DayGroup[] = [];
    for (const delivery of deliveries) {
        const date = new Date(delivery.createdAt);
        const key = dayKey(date);
        const last = groups[groups.length - 1];
        if (last && last.key === key) {
            last.items.push(delivery);
        } else {
            groups.push({
                key,
                date,
                today: key === todayKey,
                yesterday: key === yesterdayKey,
                items: [delivery]
            });
        }
    }
    return groups;
}

/** Sentinel for "no state filter" — a `Select` cannot hold an empty value. */
const ALL = 'all';

/**
 * One endpoint's delivery log.
 *
 * The list polls itself while anything in it is still in flight (see
 * `useWebhookDeliveries`), so a queued delivery becomes a delivered one on
 * screen without anybody pressing refresh.
 */
export function WebhookDeliveriesPanel({
    endpointId,
    endpointUrl,
    canRedeliver
}: {
    endpointId: string;
    /** Where deliveries are posted — shown in the detail's Request tab. */
    endpointUrl: string;
    canRedeliver: boolean;
}) {
    const intl = useIntl();
    const [status, setStatus] = useState<string>(ALL);
    const [page, setPage] = useState(1);
    const [pickedId, setPickedId] = useState<string | null>(null);

    const { data, isPending, isError, isPlaceholderData, refetch } =
        useWebhookDeliveries(endpointId, {
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            ...(status === ALL ? {} : { status })
        });
    // The picked delivery, else the newest on the page — the panel beside
    // the log is never empty while the log is not.
    const items = data?.items ?? [];
    const selectedId =
        items.find((delivery) => delivery.id === pickedId)?.id ??
        items[0]?.id ??
        null;
    const { data: detail } = useWebhookDelivery(endpointId, selectedId);
    const redeliver = useRedeliverWebhook();

    // The log shrinks under the reader — retention prunes it, a filter narrows
    // it — so a page number that was valid a moment ago can point past the end.
    // Following the server's clamp keeps the pager and the rows in agreement
    // instead of showing an empty page with no way back.
    useEffect(() => {
        if (data && page > data.pageCount) {
            setPage(data.pageCount);
        }
    }, [data, page]);

    if (isError) {
        return (
            <Alert variant="destructive" role="alert" className="mt-4">
                <AlertDescription className="flex items-center justify-between gap-4">
                    {intl.formatMessage(messages.error)}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void refetch()}
                    >
                        {intl.formatMessage(messages.retry)}
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <DeliveryStats endpointId={endpointId} />
            <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted-foreground">
                    {data
                        ? intl.formatMessage(messages.total, {
                              count: data.total
                          })
                        : null}
                </span>
                <Select
                    value={status}
                    onValueChange={(next) => {
                        setStatus(next);
                        setPage(1);
                    }}
                >
                    <SelectTrigger
                        className="w-48"
                        aria-label={intl.formatMessage(messages.filterLabel)}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>
                            {intl.formatMessage(messages.filterAll)}
                        </SelectItem>
                        {DELIVERY_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                                {intl.formatMessage(STATUS_LABELS[value])}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {!isPending && items.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                    {intl.formatMessage(messages.empty)}
                </p>
            ) : (
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                    <div
                        className="overflow-hidden rounded-xl border bg-card"
                        aria-busy={isPlaceholderData || undefined}
                    >
                        {/* Names the log for the outline, so its day
                            headings sit one level under it. */}
                        <h2 className="sr-only">
                            {intl.formatMessage(messages.caption)}
                        </h2>
                        <ul aria-label={intl.formatMessage(messages.caption)}>
                            {groupByDay(items).map((group) => (
                                <li key={group.key}>
                                    <h3 className="bg-muted/40 px-3.5 py-1.5 text-[11px] font-medium text-muted-foreground first:border-t-0">
                                        {group.today
                                            ? intl.formatMessage(messages.today)
                                            : group.yesterday
                                              ? intl.formatMessage(
                                                    messages.yesterday
                                                )
                                              : intl.formatDate(group.date, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                    </h3>
                                    <ul>
                                        {group.items.map((delivery) => (
                                            <li key={delivery.id}>
                                                <DeliveryRow
                                                    delivery={delivery}
                                                    selected={
                                                        delivery.id ===
                                                        selectedId
                                                    }
                                                    onSelect={() =>
                                                        setPickedId(delivery.id)
                                                    }
                                                />
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <DeliveryDetailPanel
                        delivery={selectedId === null ? null : detail}
                        url={endpointUrl}
                        canRedeliver={canRedeliver}
                        redelivering={redeliver.isPending}
                        onRedeliver={(deliveryId) =>
                            redeliver.mutate(
                                { endpointId, deliveryId },
                                {
                                    onSuccess: () =>
                                        toast.success(
                                            intl.formatMessage(
                                                messages.redelivered
                                            )
                                        ),
                                    onError: () =>
                                        toast.error(
                                            intl.formatMessage(
                                                messages.redeliverFailed
                                            )
                                        )
                                }
                            )
                        }
                    />
                </div>
            )}

            {data && data.pageCount > 1 ? (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.pageOf, {
                            page: data.page,
                            pageCount: data.pageCount
                        })}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={data.page <= 1}
                            onClick={() => setPage((prev) => prev - 1)}
                        >
                            {intl.formatMessage(messages.prev)}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={data.page >= data.pageCount}
                            onClick={() => setPage((prev) => prev + 1)}
                        >
                            {intl.formatMessage(messages.next)}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
