import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { httpWebhookGateway } from '../../infrastructure/httpWebhookGateway';
import {
    webhooksKeys,
    type DeliveriesListParams
} from '../../infrastructure/webhooksKeys';

/** Rows per page in the delivery log. */
export const DEFAULT_PAGE_SIZE = 25;

/** How often the log refreshes while something in it is still in flight. */
const IN_FLIGHT_POLL_MS = 3_000;

/**
 * One page of an endpoint's delivery log.
 *
 * It **polls while anything is unfinished** and stops when nothing is: a
 * delivery that is queued or waiting for its retry changes state without
 * anybody pressing anything, and a log that needs a manual refresh to show that
 * is a log people stop trusting. Once every row is terminal there is nothing
 * left to watch, so the polling stops rather than running for as long as the
 * tab is open.
 *
 * `keepPreviousData` avoids the page blanking between pages and between polls.
 */
export function useWebhookDeliveries(
    endpointId: string,
    params: DeliveriesListParams,
    enabled = true
) {
    return useQuery({
        queryKey: webhooksKeys.deliveries(endpointId, params),
        queryFn: () => httpWebhookGateway.listDeliveries(endpointId, params),
        placeholderData: keepPreviousData,
        refetchInterval: (query) => {
            const page = query.state.data;
            if (!page) return false;
            const inFlight = page.items.some(
                (delivery) =>
                    delivery.status === 'pending' ||
                    delivery.status === 'delivering' ||
                    delivery.status === 'failed'
            );
            return inFlight ? IN_FLIGHT_POLL_MS : false;
        },
        enabled
    });
}

/** One delivery with its request and response bodies, for the detail panel. */
export function useWebhookDelivery(
    endpointId: string,
    deliveryId: string | null
) {
    return useQuery({
        queryKey: [
            ...webhooksKeys.deliveriesOf(endpointId),
            'detail',
            deliveryId
        ] as const,
        queryFn: () =>
            httpWebhookGateway.getDelivery(endpointId, deliveryId as string),
        enabled: deliveryId !== null
    });
}
