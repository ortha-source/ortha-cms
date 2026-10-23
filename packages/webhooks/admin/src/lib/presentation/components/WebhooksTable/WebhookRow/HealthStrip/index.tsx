import { cn } from '@orthacms/design-system';
import type { WebhookDelivery } from '../../../../../domain/types/webhook';
import { deliveryOutcome } from '../../../../../domain/webhookHealth';

const BAR = {
    ok: 'h-full bg-success',
    failed: 'h-full bg-destructive',
    pending: 'h-full bg-muted-foreground/40'
} as const;

type HealthStripProps = {
    /** Newest first, as the log returns them. */
    deliveries: WebhookDelivery[];
    /** How many slots the strip draws; missing deliveries are empty slots. */
    slots: number;
};

/**
 * The last N deliveries as a row of bars, oldest on the left — a delivered one
 * full and green, a failed one red, one still in flight grey, an empty slot a
 * stub. Decoration: the success rate beside it says the same in words.
 */
export function HealthStrip({ deliveries, slots }: HealthStripProps) {
    const shown = deliveries.slice(0, slots).reverse();
    const empty = slots - shown.length;
    return (
        <span aria-hidden className="flex h-5 items-end gap-0.5">
            {Array.from({ length: empty }, (_, index) => (
                <i
                    key={`empty-${index}`}
                    className="h-1.5 w-1 rounded-[1px] bg-muted"
                />
            ))}
            {shown.map((delivery) => (
                <i
                    key={delivery.id}
                    className={cn(
                        'w-1 rounded-[1px]',
                        BAR[deliveryOutcome(delivery.status)]
                    )}
                />
            ))}
        </span>
    );
}
