import { HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
    COPILOT_LIMIT_CODES,
    type CopilotLimitCode,
    type CopilotLimitRefusal,
    type CopilotLimitScope
} from '@orthacms/copilot-domain';

/**
 * The English sentence an API client sees. The admin panel does not show it —
 * it renders its own translated copy keyed off `code` — so this is written for
 * whoever reads a raw response.
 */
function describe(code: CopilotLimitCode, scope: CopilotLimitScope): string {
    switch (code) {
        case COPILOT_LIMIT_CODES.QUOTA_EXCEEDED:
            return scope === 'workspace'
                ? 'This workspace’s daily copilot allowance is used up.'
                : 'Your daily copilot allowance in this workspace is used up.';
        case COPILOT_LIMIT_CODES.RATE_LIMITED:
            return 'Too many copilot requests in the last minute. Try again shortly.';
        case COPILOT_LIMIT_CODES.TOO_MANY_RUNS:
            return 'You already have as many copilot answers in progress as allowed.';
    }
}

/**
 * Turns a refusal into the `429` the run route answers with, setting
 * `Retry-After` on the response when the wait is knowable.
 *
 * The header is set here, on the response the exception filter will then
 * write, because a thrown `HttpException` carries a body and a status but no
 * headers. A quota's wait runs to midnight UTC; a concurrency refusal has no
 * knowable wait — it lifts when a run the user can see ends — so it sends none.
 */
export function limitException(
    refusal: CopilotLimitRefusal,
    res: Response,
    now: Date = new Date()
): HttpException {
    const retryAfterMs =
        refusal.retryAfterMs ??
        (refusal.resetsAt
            ? refusal.resetsAt.getTime() - now.getTime()
            : undefined);
    if (retryAfterMs !== undefined) {
        res.setHeader(
            'Retry-After',
            String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
        );
    }
    return new HttpException(
        {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: refusal.code,
            scope: refusal.scope,
            message: describe(refusal.code, refusal.scope),
            ...(refusal.resetsAt
                ? { resetsAt: refusal.resetsAt.toISOString() }
                : {})
        },
        HttpStatus.TOO_MANY_REQUESTS
    );
}
