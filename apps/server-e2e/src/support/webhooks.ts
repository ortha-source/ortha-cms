import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { getPool } from '@orthacms/database';
import { WebhookDeliveryWorker } from '@orthacms/webhooks-server';

/** One request the fixture receiver took. */
export interface ReceivedDelivery {
    headers: Record<string, string | string[] | undefined>;
    /** The raw body, exactly as it arrived — the signature covers these bytes. */
    raw: string;
    /** The parsed body, for readable assertions. */
    body: Record<string, unknown>;
}

/** A local HTTP endpoint that records what a webhook posted to it. */
export interface WebhookReceiver {
    /** The URL to configure an endpoint with. */
    url: string;
    /** Everything received so far, in arrival order. */
    received: ReceivedDelivery[];
    /** Answer the next `count` requests with this status instead of 200. */
    respondWith(status: number, count?: number): void;
    close(): Promise<void>;
}

/**
 * Starts a receiver on loopback.
 *
 * The suites post to a real socket rather than stubbing the HTTP client,
 * because the things worth asserting — that the signature covers the bytes that
 * actually went out, that the delivery headers are present and correct — only
 * exist on the wire. The harness config permits loopback for exactly this; the
 * shipped policy does not, and that refusal has its own assertion.
 */
export async function startWebhookReceiver(): Promise<WebhookReceiver> {
    const received: ReceivedDelivery[] = [];
    const scripted: number[] = [];

    const server: Server = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            received.push({
                headers: req.headers,
                raw,
                body: raw ? JSON.parse(raw) : {}
            });
            res.statusCode = scripted.shift() ?? 200;
            res.end('received');
        });
    });

    await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
    );
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}/hooks`,
        received,
        respondWith(status, count = 1) {
            for (let index = 0; index < count; index += 1) {
                scripted.push(status);
            }
        },
        close: () =>
            new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            )
    };
}

/**
 * Sends whatever is claimable right now.
 *
 * The harness runs with the sender's interval switched off, so this is how a
 * suite advances the queue — the analogue of `drainOutbox` for the second hop.
 */
export async function deliverWebhooks(app: INestApplication): Promise<void> {
    await app.get(WebhookDeliveryWorker).runOnce();
}

/**
 * Marks an aggregate's outbox rows undispatched, so the next drain delivers
 * them again.
 *
 * Not a contrivance: outbox delivery is at-least-once by design, and a
 * subscriber that failed partway through a batch sees exactly this on the
 * retry. It is the only way to prove the fan-out's unique index is doing its
 * job rather than merely existing.
 */
export async function replayOutbox(aggregateId: string): Promise<void> {
    await getPool().query(
        `UPDATE outbox_events SET dispatched_at = NULL WHERE aggregate_id = $1`,
        [aggregateId]
    );
}

/** One `webhook_deliveries` row, as the assertions read it. */
export interface DeliveryRow {
    id: string;
    endpointId: string;
    eventId: string;
    eventKind: string;
    workspaceId: string | null;
    contentType: string | null;
    status: string;
    attempts: number;
    lastStatusCode: number | null;
    payload: Record<string, unknown>;
}

/** Every queued delivery for one endpoint, oldest first. */
export async function getDeliveries(
    endpointId: string
): Promise<DeliveryRow[]> {
    const { rows } = await getPool().query<DeliveryRow>(
        `SELECT id, endpoint_id AS "endpointId", event_id AS "eventId",
                event_kind AS "eventKind", workspace_id AS "workspaceId",
                content_type AS "contentType", status, attempts,
                last_status_code AS "lastStatusCode", payload
         FROM webhook_deliveries
         WHERE endpoint_id = $1
         ORDER BY created_at, id`,
        [endpointId]
    );
    return rows;
}

/**
 * Makes a queued delivery claimable now.
 *
 * A retry is scheduled minutes out by design, so a suite that wants to watch
 * the second attempt would otherwise have to wait for it. Moving the clock on
 * the row is honest about what is being skipped — the wait — while leaving the
 * decision that produced it, and everything the next attempt does, real.
 */
export async function makeDeliveryDue(deliveryId: string): Promise<void> {
    await getPool().query(
        `UPDATE webhook_deliveries SET next_attempt_at = now() - interval '1 minute'
         WHERE id = $1`,
        [deliveryId]
    );
}
