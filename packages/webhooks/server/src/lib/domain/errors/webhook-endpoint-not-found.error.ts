/** Raised when an endpoint id does not name a row. Mapped to 404 by the http layer. */
export class WebhookEndpointNotFoundError extends Error {
    constructor(public readonly endpointId: string) {
        super(`Webhook endpoint ${endpointId} was not found.`);
        this.name = 'WebhookEndpointNotFoundError';
    }
}
