import { ConflictException, HttpStatus } from '@nestjs/common';
import type { MemberErrorCode } from '../domain/errors';

/**
 * A `409` carrying a stable machine `code` alongside the English message.
 *
 * Nest's `new ConflictException('text')` produces
 * `{ statusCode, error, message }` — three fields, none of which distinguish
 * "you cannot demote the last admin" from "you cannot change your own role".
 * Passing an **object** makes it the body verbatim, so the existing three
 * fields are repeated here deliberately: adding `code` must not remove what
 * clients already read.
 *
 * @param code stable wire code (`MEMBER_ERROR_CODES`) — append, never rename
 * @param message developer-facing English fallback
 * @param extra optional per-code detail (e.g. `retryAfterSeconds`)
 */
export function conflict(
    code: MemberErrorCode,
    message: string,
    extra?: Record<string, unknown>
): ConflictException {
    return new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message,
        code,
        ...extra
    });
}
