import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpWebhookGateway } from '../../infrastructure/httpWebhookGateway';
import { webhooksKeys } from '../../infrastructure/webhooksKeys';
import type { SaveWebhookInput } from '../../infrastructure/webhookGateway';

/** Creates an endpoint; the result carries the one-time signing secret. */
export function useCreateWebhook() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: SaveWebhookInput) =>
            httpWebhookGateway.create(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: webhooksKeys.list() });
        }
    });
}

/** Updates an endpoint's configuration. */
export function useUpdateWebhook() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: SaveWebhookInput }) =>
            httpWebhookGateway.update(id, input),
        onSuccess: (endpoint) => {
            // The response is the updated row, so the detail page can be
            // written directly rather than refetched; the list still needs
            // invalidating because the change may reorder or re-badge it.
            queryClient.setQueryData(
                webhooksKeys.detail(endpoint.id),
                endpoint
            );
            queryClient.invalidateQueries({ queryKey: webhooksKeys.list() });
        }
    });
}

/** Deletes an endpoint and, with it, its delivery log. */
export function useDeleteWebhook() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpWebhookGateway.remove(id),
        onSuccess: (_result, id) => {
            queryClient.removeQueries({ queryKey: webhooksKeys.detail(id) });
            queryClient.removeQueries({
                queryKey: webhooksKeys.deliveriesOf(id)
            });
            queryClient.invalidateQueries({ queryKey: webhooksKeys.list() });
        }
    });
}

/** Mints a new signing secret and returns it once. */
export function useRotateWebhookSecret() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => httpWebhookGateway.rotateSecret(id),
        onSuccess: ({ endpoint }) => {
            queryClient.setQueryData(
                webhooksKeys.detail(endpoint.id),
                endpoint
            );
            queryClient.invalidateQueries({ queryKey: webhooksKeys.list() });
        }
    });
}

/**
 * Sends a test ping.
 *
 * Nothing is invalidated: a test is not queued and never becomes a log row, so
 * there is no cached state it could have changed.
 */
export function useTestWebhook() {
    return useMutation({
        mutationFn: (id: string) => httpWebhookGateway.test(id)
    });
}

/** Queues an already-sent delivery again. */
export function useRedeliverWebhook() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            endpointId,
            deliveryId
        }: {
            endpointId: string;
            deliveryId: string;
        }) => httpWebhookGateway.redeliver(endpointId, deliveryId),
        onSuccess: (_delivery, { endpointId }) => {
            // Scoped to this endpoint's log rather than the whole root: the log
            // is polled, and invalidating everything would refetch every other
            // endpoint's pages for a change that cannot affect them.
            queryClient.invalidateQueries({
                queryKey: webhooksKeys.deliveriesOf(endpointId)
            });
            queryClient.invalidateQueries({ queryKey: webhooksKeys.list() });
        }
    });
}
