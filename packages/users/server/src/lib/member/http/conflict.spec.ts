import { HttpStatus } from '@nestjs/common';
import { MEMBER_ERROR_CODES } from '../domain/errors';
import { conflict } from './conflict';

/**
 * The 409 body shape, asserted as data.
 *
 * `conflict()` exists because Nest replaces the **whole** body when handed an
 * object: `new ConflictException({ code })` would answer with `{ code }` alone
 * and silently drop the `statusCode` / `error` / `message` fields every client
 * already reads. The helper's own docblock says as much — and nothing else in
 * the codebase enforces it, because a body that lost two fields still returns
 * 409 and every server-side test still passes. Only a client notices.
 */
describe('conflict()', () => {
    /** The body Nest would serialize for this exception. */
    function bodyOf(code: string, message: string, extra?: object) {
        return conflict(
            code as never,
            message,
            extra as Record<string, unknown> | undefined
        ).getResponse() as Record<string, unknown>;
    }

    it('keeps the three fields clients already read, alongside the new code', () => {
        expect(
            bodyOf(
                MEMBER_ERROR_CODES.LAST_ADMIN_PROTECTED,
                'Promote another admin first.'
            )
        ).toEqual({
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: 'Promote another admin first.',
            code: MEMBER_ERROR_CODES.LAST_ADMIN_PROTECTED
        });
    });

    it('spreads per-code detail alongside them', () => {
        expect(
            bodyOf(
                MEMBER_ERROR_CODES.INVITE_RECENTLY_SENT,
                'An invite was just sent.',
                { retryAfterSeconds: 42 }
            )
        ).toEqual({
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: 'An invite was just sent.',
            code: MEMBER_ERROR_CODES.INVITE_RECENTLY_SENT,
            retryAfterSeconds: 42
        });
    });

    it('answers 409 on the exception itself, not only in the body', () => {
        expect(
            conflict(MEMBER_ERROR_CODES.SELF_ACTION, 'Not your own account.')
        ).toHaveProperty('status', HttpStatus.CONFLICT);
    });
});
