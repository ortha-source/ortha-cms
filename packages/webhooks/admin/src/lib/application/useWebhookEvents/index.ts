import { useQuery } from '@tanstack/react-query';
import { httpWebhookGateway } from '../../infrastructure/httpWebhookGateway';
import { webhooksKeys } from '../../infrastructure/webhooksKeys';

/** How long the catalogue is treated as fresh — it changes on deploy, not in use. */
const CATALOGUE_STALE_TIME_MS = 5 * 60_000;

/**
 * The subscribable event catalogue.
 *
 * Served by the API rather than compiled into the SPA, so an admin running
 * against a newer server offers the kinds that server actually knows about —
 * the same reason the content-type picker reads `/content-schema`.
 */
export function useWebhookEvents(enabled = true) {
    return useQuery({
        queryKey: webhooksKeys.events(),
        queryFn: () => httpWebhookGateway.listEvents(),
        staleTime: CATALOGUE_STALE_TIME_MS,
        enabled
    });
}
