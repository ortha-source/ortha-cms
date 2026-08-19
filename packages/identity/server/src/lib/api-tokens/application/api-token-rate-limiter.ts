import { Injectable } from '@nestjs/common';
import {
    RateLimitPolicy,
    type RateLimitDecision,
    type RateLimitWindow
} from '../domain/rate-limit-policy';
import { ApiTokenRateLimitException } from './api-token-rate-limit.exception';

/**
 * How many windows may accumulate before an eviction pass is worth its walk.
 * Below this the map is smaller than the array a single `keys()` call would
 * allocate, so sweeping it is pure overhead.
 */
const SWEEP_THRESHOLD = 256;

/**
 * The public API's per-credential request budget — **one bucket per API token,
 * shared by every protocol that token can be spent on**: REST (`/api/v1/*`),
 * GraphQL (`POST /api/v1/graphql`) and MCP (`POST /api/v1/mcp`).
 *
 * ## Why the token, and why here
 *
 * The token id is the one key all three front doors already have before any
 * handler runs, it survives a client changing address, and it is the thing an
 * operator can act on — a 429 that names a credential tells them which
 * integration to slow down or split, where a 429 that names an IP tells them
 * about a NAT gateway. The alternative unit, the workspace, is deliberately not
 * used: a workspace's traffic is the sum of its tokens, so revoking or
 * re-issuing one credential would be no remedy for another's runaway loop.
 *
 * It lives in **identity** because identity owns the credential. Both other
 * front doors sit in packages that already depend on this one
 * (`content-server`'s `ApiTokenGuard`, `mcp-server`'s `McpAuthService`), and
 * neither depends on the other — putting the counter in either would have meant
 * a second implementation for the third protocol, which is exactly the drift a
 * shared security boundary cannot afford.
 *
 * ## What it does not do
 *
 * **In-memory and per instance**, like the login throttle beside it. Two
 * replicas mean two buckets and therefore twice the effective ceiling; a
 * deployment that needs an exact global number wants a shared store (Redis) or
 * a gateway-level limit, and this is the floor under both rather than a
 * replacement for them. It is a bound on amplification, not a billing meter.
 *
 * **Bounded memory by construction.** An entry is only ever created for a token
 * that already authenticated, so the map's cardinality is the number of minted
 * credentials — an unauthenticated flood allocates nothing. Elapsed windows are
 * swept lazily once the map is large enough for the walk to pay for itself.
 */
@Injectable()
export class ApiTokenRateLimiter {
    private readonly windows = new Map<string, RateLimitWindow>();
    private lastSweptAt = 0;

    constructor(private readonly policy: RateLimitPolicy) {}

    /** Whether any limit is configured at all. */
    get enabled(): boolean {
        return this.policy.enabled;
    }

    /**
     * Counts one request against `tokenId` and reports the outcome. Pure
     * bookkeeping — it never throws, so a caller that wants to report the
     * budget on a *successful* request can use the same call.
     */
    consume(tokenId: string, now = Date.now()): RateLimitDecision {
        if (!this.policy.enabled) {
            return this.policy.consume(undefined, now);
        }
        const decision = this.policy.consume(this.windows.get(tokenId), now);
        this.windows.set(tokenId, decision.window);
        this.sweep(now);
        return decision;
    }

    /**
     * Counts one request and refuses it with a 429 once the budget is spent.
     *
     * `tokenName` is carried into the message only — the bucket is keyed on the
     * id, so renaming a token never resets its budget.
     */
    assert(
        tokenId: string,
        tokenName?: string,
        now = Date.now()
    ): RateLimitDecision {
        const decision = this.consume(tokenId, now);
        if (!decision.allowed) {
            throw new ApiTokenRateLimitException(decision, tokenName);
        }
        return decision;
    }

    /**
     * Drops windows that have elapsed.
     *
     * At most once per window length: a sweep on every request would walk the
     * whole map on a hot path to reclaim entries that are each two numbers, and
     * the map cannot grow between sweeps by more than the number of distinct
     * tokens that authenticated in that time.
     */
    private sweep(now: number): void {
        if (
            this.windows.size < SWEEP_THRESHOLD ||
            now - this.lastSweptAt < this.policy.windowMs
        ) {
            return;
        }
        this.lastSweptAt = now;
        for (const [tokenId, window] of this.windows) {
            if (this.policy.isExpired(window, now)) {
                this.windows.delete(tokenId);
            }
        }
    }
}
