/**
 * Configuration for the webhooks plugin.
 *
 * Everything here is a deployment concern — how hard the worker is allowed to
 * push, how long it waits, what it may reach. The endpoints themselves live in
 * the database, because which systems a CMS notifies is operational data that
 * changes without a redeploy.
 */
export interface WebhooksPluginConfig {
    /**
     * How often, in milliseconds, the worker looks for claimable deliveries.
     * `0` turns delivery off entirely — rows still queue, so a deployment can
     * run the API without a sender and let one process do the sending.
     */
    deliveryIntervalMs?: number;

    /**
     * How many deliveries one tick claims. Bounds the burst a single process
     * aims at receivers, and the memory one tick holds.
     */
    batchSize?: number;

    /** Per-request timeout in milliseconds. */
    timeoutMs?: number;

    /** How many attempts a delivery gets before it is given up on. */
    maxAttempts?: number;

    /**
     * How long a completed delivery stays in the log, in days. `0` keeps them
     * forever — which is a real choice for a low-volume install, and a table
     * that grows without bound for any other.
     */
    retentionDays?: number;

    /**
     * How many consecutive dead deliveries switch an endpoint off. Without a
     * ceiling, a staging URL that was torn down months ago keeps generating six
     * requests per save for the life of the deployment.
     */
    autoDisableAfter?: number;

    /**
     * Permit `http://` destinations. Off by default — a signature over
     * plaintext still leaks the payload to the network path.
     */
    allowInsecureUrls?: boolean;

    /**
     * Permit loopback, link-local and RFC 1918 destinations. Off by default;
     * a self-hosted install whose receiver shares the cluster turns it on
     * deliberately.
     */
    allowPrivateNetworks?: boolean;

    /**
     * How long a row may sit in `delivering` before the reaper assumes the
     * worker that claimed it died, in milliseconds. Must comfortably exceed
     * {@link timeoutMs}, or a slow-but-live request gets reclaimed and sent
     * twice.
     */
    claimTimeoutMs?: number;

    /** Bytes of the response body kept for the delivery log. */
    responseSnippetBytes?: number;
}

/** Config with every optional filled in — what the services actually read. */
export type ResolvedWebhooksConfig = Required<WebhooksPluginConfig>;

/** Defaults chosen to be safe next to someone else's server, not fast. */
export const WEBHOOKS_DEFAULTS: ResolvedWebhooksConfig = {
    deliveryIntervalMs: 2_000,
    batchSize: 20,
    timeoutMs: 10_000,
    maxAttempts: 6,
    retentionDays: 30,
    autoDisableAfter: 20,
    allowInsecureUrls: false,
    allowPrivateNetworks: false,
    // Three times the request timeout: long enough that a slow receiver is
    // never reclaimed underneath a live request, short enough that a crashed
    // worker's rows move again within a minute.
    claimTimeoutMs: 30_000,
    responseSnippetBytes: 2_048
};

/** Fills the defaults in, so no service has to repeat a `??`. */
export function resolveWebhooksConfig(
    config: WebhooksPluginConfig = {}
): ResolvedWebhooksConfig {
    return { ...WEBHOOKS_DEFAULTS, ...config };
}
