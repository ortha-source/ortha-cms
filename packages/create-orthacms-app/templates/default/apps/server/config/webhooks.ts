/** Outgoing webhooks — how hard the sender pushes, and where it may reach. */
import type { WebhooksPluginConfig } from '@orthacms/webhooks-server';
import { webhooksFromEnv } from '@orthacms/config';

/**
 * Webhook delivery settings.
 *
 * From the environment: whether this process sends at all
 * (`ORTHACMS_WORKERS=false` queues without sending) and the two `allow*`
 * flags, both off by default, which widen what a URL an operator types can
 * reach. The timeout and how long a finished delivery stays in the log are
 * code (`0` keeps it forever).
 */
export function webhooksConfig(): WebhooksPluginConfig {
    return {
        timeoutMs: 10_000,
        retentionDays: 30,
        ...webhooksFromEnv()
    };
}
