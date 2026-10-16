/**
 * Webhook endpoints and a delivery log in every state.
 *
 * Seeded after all content, or every content write above would fan out into
 * real deliveries. Endpoints point at `*.invalid`, a name that can never
 * resolve, and every delivery the worker would pick up (`pending`, `failed`)
 * is scheduled a month out, so a dev server started afterwards sends nothing.
 *
 * Endpoints go through `WebhookEndpointsService` (it generates the signing
 * secret). Deliveries are inserted: the worker only moves a row it has
 * claimed, and claiming means sending.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { WebhookEndpointsService } from '../../../../../packages/webhooks/server/src/lib/application/webhook-endpoints.service';
import { webhookDeliveries } from '../../../../../packages/webhooks/server/src/lib/infrastructure/schema/webhook-deliveries';
import { webhookEndpoints } from '../../../../../packages/webhooks/server/src/lib/infrastructure/schema/webhook-endpoints';
import { daysFromNow, type SeedContext } from '../context';

const ALL_KINDS = [
    'entry.created',
    'entry.updated',
    'entry.published',
    'entry.unpublished',
    'entry.deleted',
    'entry.restored',
    'entry.purged'
];
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

type Status = 'succeeded' | 'failed' | 'dead' | 'pending';

export async function seedWebhooks(ctx: SeedContext): Promise<void> {
    const service = ctx.get(WebhookEndpointsService);
    const admin = ctx.user('admin');
    const main = ctx.workspace('main').id;

    const endpoint = async (
        name: string,
        host: string,
        options: {
            kinds?: string[];
            types?: string[];
            workspaces?: string[];
            headers?: Record<string, string>;
        } = {}
    ) => {
        const { endpoint } = await service.create(
            {
                name,
                url: `https://${host}.invalid/hooks/ortha`,
                enabled: true,
                eventKinds: options.kinds ?? ALL_KINDS,
                contentTypes: options.types ?? [],
                allWorkspaces: !options.workspaces,
                workspaceIds: (options.workspaces ?? []).map(
                    (key) => ctx.workspace(key).id
                ),
                headers: options.headers ?? {}
            },
            admin.id
        );
        return endpoint.id;
    };

    const deliver = async (
        endpointId: string,
        status: Status,
        minutes: number,
        details: {
            code?: number;
            error?: string;
            attempts?: number;
            redeliveryOf?: string;
            kind?: string;
        } = {}
    ) => {
        const id = randomUUID();
        const eventId = randomUUID();
        const kind = details.kind ?? 'entry.published';
        const entry = ctx.entry('flags_pub_published');
        const done = status === 'succeeded' || status === 'dead';
        await ctx.db.insert(webhookDeliveries).values({
            id,
            endpointId,
            eventId,
            eventKind: kind,
            workspaceId: main,
            contentType: entry.type,
            payload: {
                id,
                event: kind,
                eventId,
                occurredAt: minutesAgo(minutes).toISOString(),
                workspaceId: main,
                data: { type: entry.type, id: entry.id }
            },
            status,
            attempts: details.attempts ?? (status === 'pending' ? 0 : 1),
            // A month out: the worker claims due `pending`/`failed` rows.
            nextAttemptAt: done ? null : daysFromNow(30),
            lastStatusCode: details.code ?? null,
            lastError: details.error ?? null,
            responseSnippet:
                details.code && details.code < 300
                    ? '{"ok":true}'
                    : details.code
                      ? '{"error":"gone"}'
                      : null,
            durationMs: details.code
                ? 120 + minutes
                : details.error
                  ? 10_000
                  : null,
            redeliveryOf: details.redeliveryOf ?? null,
            createdAt: minutesAgo(minutes),
            completedAt: done ? minutesAgo(minutes - 1) : null
        });
        return id;
    };

    const rebuild = await endpoint('Site rebuild', 'rebuild.example');
    await deliver(rebuild, 'succeeded', 180, { code: 200 });
    await deliver(rebuild, 'succeeded', 120, {
        code: 204,
        kind: 'entry.updated'
    });
    await deliver(rebuild, 'succeeded', 60, {
        code: 200,
        kind: 'entry.unpublished'
    });
    const dead = await deliver(rebuild, 'dead', 90, { code: 410, attempts: 6 });
    await deliver(rebuild, 'succeeded', 30, { code: 200, redeliveryOf: dead });
    await deliver(rebuild, 'failed', 20, {
        code: 503,
        attempts: 3,
        error: 'Service Unavailable'
    });
    await deliver(rebuild, 'pending', 1, { kind: 'entry.created' });

    await endpoint('Search index', 'search.example', {
        kinds: ['entry.published', 'entry.unpublished'],
        types: ['flags_publishable', 'i18n_fields'],
        workspaces: ['main'],
        headers: { 'X-Api-Key': 'seeded-not-a-real-key' }
    });

    const legacy = await endpoint('Legacy CRM — switched off', 'crm.example', {
        workspaces: ['consumer']
    });
    await ctx.db
        .update(webhookEndpoints)
        .set({ enabled: false, disabledReason: null })
        .where(eq(webhookEndpoints.id, legacy));

    const flaky = await endpoint(
        'Flaky — disabled after failures',
        'flaky.example'
    );
    await deliver(flaky, 'dead', 300, {
        error: 'connect ETIMEDOUT',
        attempts: 6
    });
    await deliver(flaky, 'dead', 240, { code: 500, attempts: 6 });
    await ctx.db
        .update(webhookEndpoints)
        .set({
            enabled: false,
            consecutiveFailures: 20,
            disabledReason:
                'Disabled automatically after 20 consecutive failed deliveries.'
        })
        .where(eq(webhookEndpoints.id, flaky));

    await endpoint('Never fired', 'quiet.example', { kinds: ['entry.purged'] });

    ctx.section('Webhooks', [
        'Five endpoints, all on `*.invalid` hosts: "Site rebuild" (a delivery log in every state), "Search index" (filtered, custom header),',
        '"Legacy CRM" (switched off), "Flaky" (auto-disabled after 20 failures) and "Never fired" (empty log).',
        'Pending and retrying deliveries are scheduled 30 days out, so nothing is sent.'
    ]);
}
