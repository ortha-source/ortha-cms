import type { RateLimitDecision } from '../domain/rate-limit-policy';

/**
 * The slice of a response object these headers need. Structural on purpose: the
 * REST and GraphQL routes hand over an Express response, while the MCP endpoint
 * is written against Node's raw `ServerResponse`, and both carry `setHeader`.
 */
export interface RateLimitHeaderSink {
    setHeader(name: string, value: string): unknown;
    readonly headersSent?: boolean;
}

/**
 * Advertises the caller's remaining budget on a public-API response.
 *
 * The de-facto `X-RateLimit-*` trio rather than the newer RFC `RateLimit`
 * header: every HTTP client library and every CI dashboard already reads these,
 * and a public API's job here is to be legible to whatever is calling it.
 * `X-RateLimit-Reset` is **epoch seconds**, the spelling GitHub's API
 * popularised, so a client can compute a wait without a clock-skew guess.
 *
 * Written on the allowed responses as well as the refusals: a client that only
 * learns its budget at the moment it is refused has no way to back off before
 * being refused, which is the whole point of publishing it.
 */
export function applyRateLimitHeaders(
    response: RateLimitHeaderSink | undefined,
    decision: RateLimitDecision
): void {
    if (!response || response.headersSent) {
        return;
    }
    // An unlimited deployment has no budget to report, and a header reading
    // `Infinity` is worse than no header at all.
    if (!Number.isFinite(decision.remaining)) {
        return;
    }
    response.setHeader('X-RateLimit-Limit', String(decision.limit));
    response.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    response.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil(decision.resetAt / 1000))
    );
}
