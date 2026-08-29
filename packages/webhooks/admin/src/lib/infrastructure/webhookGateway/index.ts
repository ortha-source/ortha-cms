import type {
    CreatedWebhookEndpoint,
    WebhookDelivery,
    WebhookDeliveryDetail,
    WebhookDeliveryPage,
    WebhookEndpoint,
    WebhookEventOption,
    WebhookTestResult
} from '../../domain/types/webhook';
import type { WorkspaceOption } from '../../domain/types/workspaceOption';
import type { DeliveriesListParams } from '../webhooksKeys';

/**
 * What the endpoint editor submits.
 *
 * The three filters are all optional and all mean "everything" when omitted —
 * which is also what the server does with them, so the dialog's "All" toggles
 * map to simply not sending the field.
 */
export type SaveWebhookInput = {
    name: string;
    url: string;
    enabled?: boolean;
    eventKinds?: string[];
    contentTypes?: string[];
    allWorkspaces?: boolean;
    workspaceIds?: string[];
    headers?: Record<string, string>;
};

/**
 * The port over the webhooks management API — the one seam this plugin talks
 * to instead of `apiClient`. {@link httpWebhookGateway} is the implementation.
 */
export type WebhookGateway = {
    /** Every endpoint via `GET /api/webhooks`. */
    list(): Promise<WebhookEndpoint[]>;
    /** One endpoint via `GET /api/webhooks/:id`. */
    get(id: string): Promise<WebhookEndpoint>;
    /**
     * Creates one via `POST /api/webhooks`. The result carries the one-time
     * signing secret — it is never returned again.
     */
    create(input: SaveWebhookInput): Promise<CreatedWebhookEndpoint>;
    /** Updates one via `PATCH /api/webhooks/:id`. */
    update(id: string, input: SaveWebhookInput): Promise<WebhookEndpoint>;
    /** Deletes one, and its log, via `DELETE /api/webhooks/:id`. */
    remove(id: string): Promise<void>;
    /** Mints a new signing secret via `POST /api/webhooks/:id/secret`. */
    rotateSecret(id: string): Promise<CreatedWebhookEndpoint>;
    /** Sends a `ping` and reports the response via `POST /api/webhooks/:id/test`. */
    test(id: string): Promise<WebhookTestResult>;
    /** One page of the delivery log. */
    listDeliveries(
        id: string,
        params: DeliveriesListParams
    ): Promise<WebhookDeliveryPage>;
    /** One delivery with its request and response bodies. */
    getDelivery(id: string, deliveryId: string): Promise<WebhookDeliveryDetail>;
    /** Queues the same event again. */
    redeliver(id: string, deliveryId: string): Promise<WebhookDelivery>;
    /** The subscribable event catalogue, for the editor's picker. */
    listEvents(): Promise<WebhookEventOption[]>;
    /** Every workspace, for the editor's workspace picker. */
    listWorkspaceOptions(): Promise<WorkspaceOption[]>;
};
