/**
 * The per-credential request budget the public API is spent against, as a
 * pure, clock-free decision.
 *
 * Framework-free by ADR-0003: no Nest, no timers, no storage. It is handed the
 * window it is deciding about and the current time, and returns the next window
 * plus what the caller should be told. Everything stateful — the map of windows,
 * the eviction, the injection — lives in `ApiTokenRateLimiter` in the
 * application layer, which is what makes the arithmetic here (the boundary
 * cases, the `Retry-After` rounding) testable without booting an app.
 *
 * **Fixed window, not sliding.** A window opens on the first request a token
 * makes and lasts `windowMs`; the count resets when the next request arrives
 * after it has elapsed. The known cost is the boundary burst — a token can
 * spend its whole budget at the end of one window and again at the start of the
 * next, so the true worst case is `2 × limit` over `windowMs`. That is accepted
 * deliberately: the goal here is bounding sustained amplification, and the
 * alternative (a per-request timestamp log) costs memory proportional to the
 * limit for every token, on a hot path, to tighten a factor of two.
 */

/** One token's current counting window. */
export interface RateLimitWindow {
    /** Epoch ms the window opened at — the first request counted in it. */
    startedAt: number;
    /** Requests counted in it so far. */
    count: number;
}

/** What the policy decided, and what a caller reports back to the client. */
export interface RateLimitDecision {
    /** Whether this request may proceed. */
    allowed: boolean;
    /** The configured ceiling, echoed for the `X-RateLimit-Limit` header. */
    limit: number;
    /** Requests left in the current window; `0` once refused. */
    remaining: number;
    /** Epoch ms the current window ends (and the budget resets). */
    resetAt: number;
    /**
     * Whole seconds until the reset, floored at 1 — `Retry-After: 0` reads as
     * "retry immediately", which is the opposite of what a refusal means.
     */
    retryAfterSeconds: number;
    /** The window to store back against this token. */
    window: RateLimitWindow;
}

/** How many requests a single token may make per window. */
export interface RateLimitSettings {
    /** Window length in milliseconds. */
    windowMs: number;
    /**
     * Requests permitted per window, per token. `0` (or negative) turns the
     * limit off entirely — an escape hatch for a deployment whose public API
     * sits behind its own gateway, not the default.
     */
    limit: number;
}

/** The fixed-window budget, as a value object over its settings. */
export class RateLimitPolicy {
    constructor(private readonly settings: RateLimitSettings) {}

    /** Whether the policy limits anything at all. */
    get enabled(): boolean {
        return this.settings.limit > 0 && this.settings.windowMs > 0;
    }

    /** The configured ceiling. */
    get limit(): number {
        return this.settings.limit;
    }

    /** The configured window length, in milliseconds. */
    get windowMs(): number {
        return this.settings.windowMs;
    }

    /**
     * Counts one request against `window` and decides whether it proceeds.
     *
     * A `window` of `undefined` (an unseen token) and one whose window has
     * elapsed are the same case — both open a fresh window at `now`, which is
     * why an idle token is never penalised for a burst it made an hour ago.
     *
     * A **refused** request does not increment the count. Counting it would let
     * a caller that keeps hammering through the refusal push its own reset out
     * indefinitely under a sliding scheme, and under this one it buys nothing
     * except an ever-growing number nobody reads. The window still ends when it
     * was always going to end, so the advertised `Retry-After` stays true.
     */
    consume(
        window: RateLimitWindow | undefined,
        now: number
    ): RateLimitDecision {
        if (!this.enabled) {
            return {
                allowed: true,
                limit: this.settings.limit,
                remaining: Number.POSITIVE_INFINITY,
                resetAt: now,
                retryAfterSeconds: 0,
                window: { startedAt: now, count: 0 }
            };
        }

        const current =
            window && now - window.startedAt < this.settings.windowMs
                ? window
                : { startedAt: now, count: 0 };
        const resetAt = current.startedAt + this.settings.windowMs;

        if (current.count >= this.settings.limit) {
            return {
                allowed: false,
                limit: this.settings.limit,
                remaining: 0,
                resetAt,
                retryAfterSeconds: Math.max(
                    1,
                    Math.ceil((resetAt - now) / 1000)
                ),
                window: current
            };
        }

        const next: RateLimitWindow = {
            startedAt: current.startedAt,
            count: current.count + 1
        };
        return {
            allowed: true,
            limit: this.settings.limit,
            remaining: this.settings.limit - next.count,
            resetAt,
            retryAfterSeconds: 0,
            window: next
        };
    }

    /** Whether a stored window has elapsed and can be evicted. */
    isExpired(window: RateLimitWindow, now: number): boolean {
        return now - window.startedAt >= this.settings.windowMs;
    }
}
