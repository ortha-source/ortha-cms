import type {
    DeliveryStatus,
    WebhookDelivery,
    WebhookDeliveryDetail,
    WebhookEndpoint,
    WebhookEventOption,
    WebhookLastDelivery
} from '../../domain/types/webhook';
import type { WorkspaceOption } from '../../domain/types/workspaceOption';

/**
 * The wire shapes and the mapping into the admin's models — the
 * anti-corruption layer for this plugin.
 *
 * The admin restates the server's view types locally rather than importing
 * them: the module boundary forbids reaching into a server package, and the
 * restatement is what makes a server-side rename show up here as a type error
 * instead of as `undefined` in a cell.
 */

/** `GET /api/webhooks` and `GET /api/webhooks/:id`. */
export type WebhookEndpointResponse = {
    id: string;
    name: string;
    url: string;
    secretHint: string;
    enabled: boolean;
    eventKinds: string[];
    contentTypes: string[];
    allWorkspaces: boolean;
    workspaceIds: string[];
    headers: Record<string, string>;
    disabledReason: string | null;
    consecutiveFailures: number;
    createdAt: string;
    updatedAt: string;
    lastDelivery: WebhookLastDeliveryResponse | null;
};

/** The last-delivery summary carried on an endpoint row. */
export type WebhookLastDeliveryResponse = {
    id: string;
    status: string;
    eventKind: string;
    statusCode: number | null;
    createdAt: string;
};

/** The create/rotate response — the only one carrying a secret. */
export type CreatedWebhookEndpointResponse = {
    endpoint: WebhookEndpointResponse;
    secret: string;
};

/** One row of `GET /api/webhooks/:id/deliveries`. */
export type WebhookDeliveryResponse = {
    id: string;
    endpointId: string;
    eventId: string;
    eventKind: string;
    workspaceId: string | null;
    contentType: string | null;
    status: string;
    attempts: number;
    nextAttemptAt: string | null;
    statusCode: number | null;
    error: string | null;
    durationMs: number | null;
    createdAt: string;
    completedAt: string | null;
};

/** `GET /api/webhooks/:id/deliveries/:deliveryId`. */
export type WebhookDeliveryDetailResponse = WebhookDeliveryResponse & {
    payload: unknown;
    responseSnippet: string | null;
};

/** `GET /api/webhook-events`. */
export type WebhookEventResponse = {
    kind: string;
    group: string;
    label: string;
    scopedByContentType: boolean;
    carriesWorkspace: boolean;
};

/** Only the fields the workspace picker needs from `GET /api/workspaces`. */
export type WorkspaceOptionResponse = {
    id: string;
    name: string;
    description: string | null;
};

/** Maps an endpoint from the wire. */
export function toWebhookEndpoint(
    dto: WebhookEndpointResponse
): WebhookEndpoint {
    return {
        ...dto,
        lastDelivery: dto.lastDelivery ? toLastDelivery(dto.lastDelivery) : null
    };
}

/** Maps the last-delivery summary. */
function toLastDelivery(dto: WebhookLastDeliveryResponse): WebhookLastDelivery {
    return { ...dto, status: dto.status as DeliveryStatus };
}

/** Maps one delivery row. */
export function toWebhookDelivery(
    dto: WebhookDeliveryResponse
): WebhookDelivery {
    return { ...dto, status: dto.status as DeliveryStatus };
}

/** Maps one delivery with its bodies. */
export function toWebhookDeliveryDetail(
    dto: WebhookDeliveryDetailResponse
): WebhookDeliveryDetail {
    return {
        ...toWebhookDelivery(dto),
        payload: dto.payload,
        responseSnippet: dto.responseSnippet
    };
}

/** Maps one event descriptor. */
export function toWebhookEventOption(
    dto: WebhookEventResponse
): WebhookEventOption {
    return { ...dto };
}

/** Maps a workspace row to the picker's option shape. */
export function toWorkspaceOption(
    dto: WorkspaceOptionResponse
): WorkspaceOption {
    return { id: dto.id, name: dto.name, description: dto.description };
}
