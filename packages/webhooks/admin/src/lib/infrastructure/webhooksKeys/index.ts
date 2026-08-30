/** Filters and paging accepted by `GET /api/webhooks/:id/deliveries`. */
export type DeliveriesListParams = {
    /** Only deliveries in this state. */
    status?: string;
    /** Only deliveries of this event kind. */
    eventKind?: string;
    /** 1-based page number. */
    page?: number;
    /** Rows per page. */
    pageSize?: number;
};

/**
 * Query keys for the webhooks cache.
 *
 * Deliveries hang off their endpoint's key rather than a flat root, so
 * refreshing one endpoint's log after a redelivery does not invalidate every
 * other endpoint's — the log is the one query here that is actively polled.
 */
export const webhooksKeys = {
    /** Root key covering every webhooks query. */
    all: ['webhooks'] as const,
    /** The endpoint list. */
    list: () => ['webhooks', 'list'] as const,
    /** One endpoint. */
    detail: (id: string) => ['webhooks', 'detail', id] as const,
    /** Every delivery query for one endpoint. */
    deliveriesOf: (id: string) => ['webhooks', 'deliveries', id] as const,
    /** One page of one endpoint's log. */
    deliveries: (id: string, params: DeliveriesListParams) =>
        ['webhooks', 'deliveries', id, params] as const,
    /** The subscribable event catalogue. */
    events: () => ['webhooks', 'events'] as const,
    /** The code-defined content-type catalogue, for the editor's picker. */
    contentTypes: () => ['webhooks', 'content-types'] as const
};
