/** Outgoing webhooks — how hard the sender pushes, and where it may reach. */
import type { WebhooksPluginConfig } from '@orthacms/webhooks-server';

import { webhooksFromEnv } from '@orthacms/config';

/**
 * Webhook delivery settings.
 *
 * From the environment: whether this process sends at all
 * (`ORTHACMS_WORKERS=false` queues without sending, for web nodes in front of
 * a dedicated worker) and the two `allow*` flags, which both default to
 * **off** and both widen what a URL an operator types can reach —
 * `WEBHOOKS_ALLOW_INSECURE_URLS` permits plain HTTP, and
 * `WEBHOOKS_ALLOW_PRIVATE_NETWORKS` permits loopback and RFC 1918, which a
 * self-hosted install with an in-cluster receiver genuinely needs and an
 * internet-facing one must not have.
 *
 * The rest is code: the per-request timeout, and how long a finished delivery
 * stays in the log (`0` keeps it forever; nothing else prunes the table).
 */
export function webhooksConfig(): WebhooksPluginConfig {
    return {
        timeoutMs: 10_000,
        retentionDays: 30,
        ...webhooksFromEnv()
    };
}
