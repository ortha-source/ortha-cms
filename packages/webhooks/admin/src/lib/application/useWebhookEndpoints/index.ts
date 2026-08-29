import { useQuery } from '@tanstack/react-query';
import { httpWebhookGateway } from '../../infrastructure/httpWebhookGateway';
import { webhooksKeys } from '../../infrastructure/webhooksKeys';

/**
 * Every configured endpoint.
 *
 * Not paginated: this is deployment configuration, and an installation with
 * enough endpoints to need pages has a different problem. `enabled` is how the
 * caller withholds the request until `webhooks:read` is confirmed, so an
 * unauthorized page never fires a request the server would 403.
 */
export function useWebhookEndpoints(enabled = true) {
    return useQuery({
        queryKey: webhooksKeys.list(),
        queryFn: () => httpWebhookGateway.list(),
        enabled
    });
}

/** One endpoint, for the detail page. */
export function useWebhookEndpoint(id: string, enabled = true) {
    return useQuery({
        queryKey: webhooksKeys.detail(id),
        queryFn: () => httpWebhookGateway.get(id),
        enabled
    });
}
