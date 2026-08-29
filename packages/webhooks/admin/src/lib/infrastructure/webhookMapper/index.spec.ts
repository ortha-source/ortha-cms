import {
    toWebhookDelivery,
    toWebhookDeliveryDetail,
    toWebhookEndpoint,
    toWorkspaceOption,
    type WebhookDeliveryResponse,
    type WebhookEndpointResponse
} from './index';
import { webhooksKeys } from '../webhooksKeys';

const endpoint: WebhookEndpointResponse = {
    id: 'wh_1',
    name: 'Storefront',
    url: 'https://example.com/hooks',
    secretHint: 'a1b2',
    enabled: true,
    eventKinds: [],
    contentTypes: [],
    allWorkspaces: true,
    workspaceIds: [],
    headers: {},
    disabledReason: null,
    consecutiveFailures: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastDelivery: {
        id: 'del_1',
        status: 'succeeded',
        eventKind: 'entry.published',
        statusCode: 200,
        createdAt: '2026-01-01T00:00:00.000Z'
    }
};

const delivery: WebhookDeliveryResponse = {
    id: 'del_1',
    endpointId: 'wh_1',
    eventId: 'evt_1',
    eventKind: 'entry.published',
    workspaceId: 'ws_1',
    contentType: 'article',
    status: 'succeeded',
    attempts: 1,
    nextAttemptAt: null,
    statusCode: 200,
    error: null,
    durationMs: 42,
    createdAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:00.000Z'
};

describe('the wire → view mapping', () => {
    it('never carries a secret, only its hint', () => {
        const view = toWebhookEndpoint(endpoint);
        // The shape is the guard: a `secret` key reaching a view model is how a
        // signing key would end up rendered somewhere.
        expect(view).not.toHaveProperty('secret');
        expect(view.secretHint).toBe('a1b2');
    });

    it('keeps an empty filter empty rather than defaulting it', () => {
        const view = toWebhookEndpoint(endpoint);
        // Empty means "everything" downstream. A mapper that helpfully filled
        // these in would invert the subscription on the next save.
        expect(view.eventKinds).toEqual([]);
        expect(view.contentTypes).toEqual([]);
        expect(view.workspaceIds).toEqual([]);
    });

    it('passes a missing last delivery through as null', () => {
        expect(
            toWebhookEndpoint({ ...endpoint, lastDelivery: null }).lastDelivery
        ).toBeNull();
    });

    it('maps a delivery without inventing a status', () => {
        expect(toWebhookDelivery(delivery).status).toBe('succeeded');
        expect(toWebhookDelivery({ ...delivery, status: 'dead' }).status).toBe(
            'dead'
        );
    });

    it('carries the frozen payload and the response snippet on a detail', () => {
        const detail = toWebhookDeliveryDetail({
            ...delivery,
            payload: { event: 'entry.published' },
            responseSnippet: 'ok'
        });
        expect(detail.payload).toEqual({ event: 'entry.published' });
        expect(detail.responseSnippet).toBe('ok');
    });

    it('keeps a workspace description as null rather than as an empty string', () => {
        expect(
            toWorkspaceOption({ id: 'ws_1', name: 'Marketing', description: null })
        ).toEqual({ id: 'ws_1', name: 'Marketing', description: null });
    });
});

describe('the query keys', () => {
    it('hangs deliveries off their endpoint', () => {
        // This is what lets a redelivery invalidate one endpoint's log without
        // refetching every other endpoint's pages — the log is the one query
        // here that is actively polled.
        expect(webhooksKeys.deliveries('wh_1', { page: 1 })).toEqual([
            ...webhooksKeys.deliveriesOf('wh_1'),
            { page: 1 }
        ]);
    });

    it('separates one endpoint’s log from another’s', () => {
        expect(webhooksKeys.deliveriesOf('wh_1')).not.toEqual(
            webhooksKeys.deliveriesOf('wh_2')
        );
    });

    it('puts every key under one root, so a full refresh is possible', () => {
        for (const key of [
            webhooksKeys.list(),
            webhooksKeys.detail('wh_1'),
            webhooksKeys.deliveriesOf('wh_1'),
            webhooksKeys.events()
        ]) {
            expect(key[0]).toBe(webhooksKeys.all[0]);
        }
    });
});
