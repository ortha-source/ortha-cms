import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import type { WebhookDelivery } from '../../../../domain/types/webhook';
import { deliveryOutcome } from '../../../../domain/webhookHealth';

const messages = defineMessages({
    tries: {
        id: 'webhooks.deliveries.row.tries',
        defaultMessage: '{code} · {count, plural, one {# try} other {# tries}}'
    },
    pending: { id: 'webhooks.status.pending', defaultMessage: 'Queued' },
    delivering: { id: 'webhooks.status.delivering', defaultMessage: 'Sending' },
    failed: { id: 'webhooks.status.failed', defaultMessage: 'Retrying' },
    dead: { id: 'webhooks.status.dead', defaultMessage: 'Failed' },
    noResponse: {
        id: 'webhooks.deliveries.row.noResponse',
        defaultMessage: 'no response'
    }
});

const DOT = {
    ok: 'bg-success',
    failed: 'bg-destructive',
    pending: 'bg-muted-foreground/50'
} as const;

/** What the row's right-hand side says about the outcome. */
function outcomeLabel(
    delivery: WebhookDelivery,
    format: ReturnType<typeof useIntl>['formatMessage']
): string {
    if (delivery.status === 'pending' || delivery.status === 'delivering') {
        return format(messages[delivery.status]);
    }
    if (delivery.status === 'failed' && delivery.statusCode === null) {
        return format(messages.failed);
    }
    const code =
        delivery.statusCode === null
            ? format(messages.noResponse)
            : String(delivery.statusCode);
    return delivery.attempts > 1
        ? format(messages.tries, { code, count: delivery.attempts })
        : code;
}

type DeliveryRowProps = {
    delivery: WebhookDelivery;
    selected: boolean;
    onSelect: () => void;
};

/**
 * One delivery in the log: an outcome dot, the event and what it was about,
 * the response, and the time. A button — picking it shows the delivery in
 * the panel beside the list (`aria-pressed`), it navigates nowhere.
 */
export function DeliveryRow({
    delivery,
    selected,
    onSelect
}: DeliveryRowProps) {
    const intl = useIntl();
    const outcome = deliveryOutcome(delivery.status);
    const failed = delivery.status === 'failed' || delivery.status === 'dead';

    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className={cn(
                'flex w-full items-center gap-3 border-t px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                selected && 'bg-muted hover:bg-muted'
            )}
        >
            <span
                aria-hidden
                className={cn('size-2 shrink-0 rounded-full', DOT[outcome])}
            />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-[13px]">
                    {delivery.eventKind}
                </span>
                {delivery.contentType ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                        {delivery.contentType}
                    </span>
                ) : null}
            </span>
            <span className="flex shrink-0 flex-col items-end">
                <span
                    className={cn(
                        'text-xs tabular-nums',
                        failed ? 'text-destructive' : 'text-foreground'
                    )}
                >
                    {outcomeLabel(delivery, intl.formatMessage)}
                </span>
                <time
                    dateTime={delivery.createdAt}
                    className="text-[11px] tabular-nums text-muted-foreground"
                >
                    {intl.formatTime(delivery.createdAt, {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </time>
            </span>
        </button>
    );
}
