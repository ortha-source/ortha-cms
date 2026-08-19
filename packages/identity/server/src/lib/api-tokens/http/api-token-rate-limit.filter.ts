import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { ApiTokenRateLimitException } from '../application/api-token-rate-limit.exception';
import {
    applyRateLimitHeaders,
    type RateLimitHeaderSink
} from './rate-limit-headers';

/**
 * Turns a spent token budget into a well-formed 429: `Retry-After` plus the
 * `X-RateLimit-*` trio, over Nest's ordinary error body.
 *
 * Registered **globally** (`APP_FILTER`, from the identity module) rather than
 * per controller, because the three front doors that consume the budget do not
 * share a base class or even a package — the REST and GraphQL routes refuse
 * from `ApiTokenGuard`, the MCP endpoint from `McpAuthService`, and a fourth
 * protocol added later would have to remember a `@UseFilters` it cannot be
 * reminded of. One filter means one shape of 429 on every protocol, and a throw
 * site that has to know nothing about responses.
 *
 * `Retry-After` is the header a well-behaved client actually backs off on, and
 * the one thing the login throttle's 429 (`@nestjs/throttler`) cannot offer per
 * credential.
 */
@Catch(ApiTokenRateLimitException)
export class ApiTokenRateLimitFilter extends BaseExceptionFilter {
    override catch(
        exception: ApiTokenRateLimitException,
        host: ArgumentsHost
    ): void {
        const response = host
            .switchToHttp()
            .getResponse<RateLimitHeaderSink | undefined>();
        if (response && !response.headersSent) {
            response.setHeader(
                'Retry-After',
                String(exception.decision.retryAfterSeconds)
            );
            applyRateLimitHeaders(response, exception.decision);
        }
        super.catch(exception, host);
    }
}
