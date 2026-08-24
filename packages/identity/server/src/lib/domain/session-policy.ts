/**
 * Refresh `lastUsedAt` at most this often, so a read path isn't a write per hit.
 * The default matches the value the session read path historically used.
 */
export const DEFAULT_LAST_USED_THROTTLE_MS = 60_000;

/**
 * The rules governing a session's lifetime and refresh cadence — the expiry and
 * throttle logic lifted out of the session service into a pure, DB-free domain
 * object. Constructed with the configured TTL, so the policy (not scattered
 * service code) is the one place these rules live and are unit-tested.
 */
export class SessionPolicy {
    constructor(
        private readonly ttlSeconds: number,
        private readonly lastUsedThrottleMs: number = DEFAULT_LAST_USED_THROTTLE_MS
    ) {}

    /**
     * The absolute expiry for a session opened at `now`: `now + ttlSeconds`.
     *
     * `ttlSecondsOverride` shortens (or lengthens) it for one session. Its one
     * use today is the SSO lifetime: a directory can disable someone at any
     * moment and the CMS does not hear about it unless the provider supports
     * back-channel logout, so a deployment can choose to have those sessions
     * expire sooner and re-check with the provider. A non-positive override is
     * ignored rather than issuing a session that is already expired.
     */
    expiresAt(now: Date, ttlSecondsOverride?: number): Date {
        const ttl =
            ttlSecondsOverride && ttlSecondsOverride > 0
                ? ttlSecondsOverride
                : this.ttlSeconds;
        return new Date(now.getTime() + ttl * 1000);
    }

    /**
     * Whether a hit at `now` should write back `lastUsedAt`, given when it was
     * last refreshed. Throttled so an authenticated GET doesn't issue a write on
     * every request — only once the throttle window has elapsed.
     */
    shouldRefreshLastUsed(lastUsedAt: Date, now: Date): boolean {
        return now.getTime() - lastUsedAt.getTime() > this.lastUsedThrottleMs;
    }
}
