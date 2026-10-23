import type {
    DeliveryStatus,
    WebhookDelivery,
    WebhookEndpoint
} from '../types/webhook';

/** What an endpoint is doing, as the list and the detail page say it. */
export type WebhookState = 'active' | 'paused' | 'stopped';

/**
 * Switched off by the delivery worker after failing in a row — as opposed to
 * paused by someone. The two must read differently: one is a decision, the
 * other an outage nobody has noticed yet.
 */
export function isStopped(
    endpoint: Pick<WebhookEndpoint, 'enabled' | 'disabledReason'>
): boolean {
    return !endpoint.enabled && !!endpoint.disabledReason;
}

/** The endpoint's state: active, paused by someone, or stopped by failures. */
export function webhookState(
    endpoint: Pick<WebhookEndpoint, 'enabled' | 'disabledReason'>
): WebhookState {
    if (endpoint.enabled) return 'active';
    return isStopped(endpoint) ? 'stopped' : 'paused';
}

/** How one delivery reads in a health strip. */
export type DeliveryOutcome = 'ok' | 'failed' | 'pending';

/** A delivery's outcome — still in flight counts as neither. */
export function deliveryOutcome(status: DeliveryStatus): DeliveryOutcome {
    if (status === 'succeeded') return 'ok';
    if (status === 'failed' || status === 'dead') return 'failed';
    return 'pending';
}

/**
 * The share of finished deliveries that succeeded, 0–100, or `null` when none
 * has finished — "100%" over nothing would claim a record there is not.
 */
export function successRate(deliveries: WebhookDelivery[]): number | null {
    const finished = deliveries.filter(
        (delivery) => deliveryOutcome(delivery.status) !== 'pending'
    );
    if (finished.length === 0) return null;
    const ok = finished.filter(
        (delivery) => deliveryOutcome(delivery.status) === 'ok'
    ).length;
    return Math.round((ok / finished.length) * 100);
}

/**
 * The median response time of the deliveries that got one, in milliseconds,
 * or `null` with none — a median over nothing is not zero.
 */
export function medianDuration(deliveries: WebhookDelivery[]): number | null {
    const times = deliveries
        .map((delivery) => delivery.durationMs)
        .filter((ms): ms is number => ms !== null)
        .sort((a, b) => a - b);
    if (times.length === 0) return null;
    const middle = Math.floor(times.length / 2);
    return times.length % 2
        ? times[middle]
        : Math.round((times[middle - 1] + times[middle]) / 2);
}
