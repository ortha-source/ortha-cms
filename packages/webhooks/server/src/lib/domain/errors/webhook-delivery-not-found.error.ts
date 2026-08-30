/**
 * Raised when a delivery id does not name a row **on the endpoint asked for**.
 *
 * Scoped to the endpoint deliberately: a delivery that exists elsewhere and one
 * that does not exist at all must be indistinguishable, or the log becomes a
 * way to probe for ids across endpoints.
 */
export class WebhookDeliveryNotFoundError extends Error {
    constructor(public readonly deliveryId: string) {
        super(`Webhook delivery ${deliveryId} was not found.`);
        this.name = 'WebhookDeliveryNotFoundError';
    }
}
