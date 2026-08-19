import { HttpException, HttpStatus } from '@nestjs/common';
import type { RateLimitDecision } from '../domain/rate-limit-policy';

/**
 * The 429 a public-API caller gets once its token has spent the window's
 * budget. Carries the {@link RateLimitDecision} so
 * `ApiTokenRateLimitFilter` can turn it into `Retry-After` and the
 * `X-RateLimit-*` headers without recomputing anything.
 *
 * A distinct class rather than a bare `ThrottlerException`: the login throttle
 * (`@nestjs/throttler`, keyed on the client IP) and this one (keyed on the
 * credential) answer with the same status for entirely different reasons, and
 * only this one has a per-token reset to advertise.
 *
 * The message names the token, not the caller's address — an operator reading a
 * 429 from a build pipeline needs to know **which credential** to raise or
 * split, and the token name is the thing they can find in the admin.
 */
export class ApiTokenRateLimitException extends HttpException {
    constructor(
        readonly decision: RateLimitDecision,
        tokenName?: string
    ) {
        super(
            {
                statusCode: HttpStatus.TOO_MANY_REQUESTS,
                error: 'Too Many Requests',
                message: `Rate limit exceeded for this API token${
                    tokenName ? ` (${tokenName})` : ''
                }: ${decision.limit} requests per window. Retry in ${
                    decision.retryAfterSeconds
                }s.`
            },
            HttpStatus.TOO_MANY_REQUESTS
        );
    }
}
