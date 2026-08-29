import { WEBHOOKS_DEFAULTS } from '../types/webhooks-config';
import { WebhookDeliveryWorker } from './webhook-delivery.worker';
import type {
    ClaimedDelivery,
    WebhookDeliveryRepository
} from './webhook-delivery.repository';
import type {
    EndpointWithSecret,
    WebhookEndpointRepository
} from './webhook-endpoint.repository';
import type { WebhookHttpClient, WebhookResponse } from './webhook-http.client';

const claimed: ClaimedDelivery = {
    id: 'delivery-1',
    endpointId: 'endpoint-1',
    eventId: 'event-1',
    eventKind: 'entry.published',
    workspaceId: 'workspace-1',
    payload: { event: 'entry.published' },
    attempts: 0
};

const endpoint: EndpointWithSecret = {
    id: 'endpoint-1',
    name: 'Storefront',
    url: 'https://example.com/hooks',
    secret: 'whsec_x',
    headers: {},
    includeEntry: false,
    enabled: true
};

function response(overrides: Partial<WebhookResponse> = {}): WebhookResponse {
    return {
        statusCode: 200,
        error: null,
        responseSnippet: 'ok',
        durationMs: 12,
        ...overrides
    };
}

/** A worker wired to fakes, plus the calls it made. */
function build(options: {
    delivery?: ClaimedDelivery;
    endpoint?: EndpointWithSecret | null;
    response?: WebhookResponse;
    maxAttempts?: number;
}) {
    const deliveries = {
        claim: jest.fn().mockResolvedValue([options.delivery ?? claimed]),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markRetrying: jest.fn().mockResolvedValue(undefined),
        markDead: jest.fn().mockResolvedValue(undefined),
        pruneCompletedBefore: jest.fn().mockResolvedValue(0)
    } as unknown as WebhookDeliveryRepository;

    const endpoints = {
        findForDelivery: jest
            .fn()
            .mockResolvedValue(
                options.endpoint === undefined ? endpoint : options.endpoint
            ),
        recordSuccess: jest.fn().mockResolvedValue(undefined),
        recordFailure: jest.fn().mockResolvedValue(false)
    } as unknown as WebhookEndpointRepository;

    const http = {
        send: jest.fn().mockResolvedValue(options.response ?? response())
    } as unknown as WebhookHttpClient;

    const worker = new WebhookDeliveryWorker(deliveries, endpoints, http, {
        ...WEBHOOKS_DEFAULTS,
        maxAttempts: options.maxAttempts ?? WEBHOOKS_DEFAULTS.maxAttempts
    });

    return { worker, deliveries, endpoints, http, tick: () => worker.runOnce() };
}

describe('WebhookDeliveryWorker', () => {
    describe('a successful delivery', () => {
        it('is closed and clears the endpoint’s failure streak', async () => {
            const { tick, deliveries, endpoints } = build({});
            await tick();

            expect(deliveries.markSucceeded).toHaveBeenCalledWith(
                'delivery-1',
                expect.objectContaining({ statusCode: 200 })
            );
            expect(endpoints.recordSuccess).toHaveBeenCalledWith('endpoint-1');
        });

        it('sends the frozen payload and the attempt number', async () => {
            const { tick, http } = build({});
            await tick();

            expect(http.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: { event: 'entry.published' },
                    deliveryId: 'delivery-1',
                    eventId: 'event-1',
                    attempt: 1
                })
            );
        });
    });

    describe('a retryable failure', () => {
        it('schedules another attempt on a 5xx', async () => {
            const { tick, deliveries } = build({
                response: response({ statusCode: 503 })
            });
            await tick();

            expect(deliveries.markRetrying).toHaveBeenCalledWith(
                'delivery-1',
                expect.objectContaining({ statusCode: 503 }),
                expect.any(Date)
            );
        });

        it('treats a transport failure with no status as retryable', async () => {
            const { tick, deliveries } = build({
                response: response({
                    statusCode: null,
                    error: 'The receiver did not respond in time.',
                    responseSnippet: null
                })
            });
            await tick();

            expect(deliveries.markRetrying).toHaveBeenCalled();
            expect(deliveries.markDead).not.toHaveBeenCalled();
        });

        it('honours a Retry-After instead of its own schedule', async () => {
            const { tick, deliveries } = build({
                response: response({ statusCode: 429, retryAfterMs: 120_000 })
            });
            const before = Date.now();
            await tick();

            const [, , nextAttemptAt] = (deliveries.markRetrying as jest.Mock)
                .mock.calls[0];
            const delay = (nextAttemptAt as Date).getTime() - before;
            // Within a second of the requested two minutes — the schedule's own
            // first step is ten seconds, so this could only come from the header.
            expect(delay).toBeGreaterThan(119_000);
            expect(delay).toBeLessThan(121_000);
        });
    });

    describe('a fatal failure', () => {
        it('gives up immediately on a 4xx', async () => {
            const { tick, deliveries } = build({
                response: response({ statusCode: 404 })
            });
            await tick();

            expect(deliveries.markDead).toHaveBeenCalledWith(
                'delivery-1',
                expect.objectContaining({
                    statusCode: 404,
                    error: expect.stringContaining('404')
                })
            );
            expect(deliveries.markRetrying).not.toHaveBeenCalled();
        });

        it('gives up once the attempt budget is spent', async () => {
            const { tick, deliveries } = build({
                delivery: { ...claimed, attempts: 5 },
                response: response({ statusCode: 500 }),
                maxAttempts: 6
            });
            await tick();

            expect(deliveries.markDead).toHaveBeenCalled();
            expect(deliveries.markRetrying).not.toHaveBeenCalled();
        });

        it('counts against the endpoint so it can be switched off', async () => {
            const { tick, endpoints } = build({
                response: response({ statusCode: 404 })
            });
            await tick();

            expect(endpoints.recordFailure).toHaveBeenCalledWith(
                'endpoint-1',
                WEBHOOKS_DEFAULTS.autoDisableAfter
            );
        });
    });

    describe('the endpoint changed under the claim', () => {
        it('closes the delivery when the endpoint was deleted', async () => {
            const { tick, deliveries, http } = build({ endpoint: null });
            await tick();

            expect(http.send).not.toHaveBeenCalled();
            expect(deliveries.markDead).toHaveBeenCalledWith(
                'delivery-1',
                expect.objectContaining({
                    error: expect.stringContaining('deleted')
                })
            );
        });

        it('does not send to an endpoint that was switched off', async () => {
            const { tick, deliveries, http } = build({
                endpoint: { ...endpoint, enabled: false }
            });
            await tick();

            // The switch has to mean something for rows already queued, or
            // disabling a runaway endpoint would not stop the runaway.
            expect(http.send).not.toHaveBeenCalled();
            expect(deliveries.markDead).toHaveBeenCalled();
        });
    });

    it('survives a failing tick rather than killing the interval', async () => {
        const { worker, tick, deliveries } = build({});
        (deliveries.claim as jest.Mock).mockRejectedValueOnce(
            new Error('database is away')
        );

        await expect(tick()).resolves.toBeUndefined();
        // And the next tick still runs.
        await tick();
        expect(deliveries.markSucceeded).toHaveBeenCalled();
        await worker.onModuleDestroy();
    });
});
