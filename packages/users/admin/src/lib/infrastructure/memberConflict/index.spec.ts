import { describe, expect, it } from 'vitest';
import { ApiError } from '@orthacms/utils-admin';
import { memberConflictOf } from '.';

/** An `ApiError` as the gateway normalises one. */
function apiError(status: number, details?: unknown): ApiError {
    return new ApiError(status, 'x', details);
}

describe('memberConflictOf', () => {
    it('reads the code and its detail off a 409', () => {
        expect(
            memberConflictOf(
                apiError(409, {
                    code: 'EMAIL_TAKEN',
                    emails: ['Ada@Orthacms.dev', 7]
                })
            )
        ).toEqual({
            code: 'EMAIL_TAKEN',
            retryAfterSeconds: null,
            emails: ['ada@orthacms.dev']
        });
        expect(
            memberConflictOf(
                apiError(409, {
                    code: 'INVITE_RECENTLY_SENT',
                    retryAfterSeconds: 42
                })
            )?.retryAfterSeconds
        ).toBe(42);
    });

    it('is null for anything but a conflict', () => {
        expect(memberConflictOf(apiError(500))).toBeNull();
        expect(memberConflictOf(null)).toBeNull();
    });

    it('survives a body that is not the documented shape', () => {
        expect(memberConflictOf(apiError(409, 'nope'))).toEqual({
            code: null,
            retryAfterSeconds: null,
            emails: []
        });
    });
});
