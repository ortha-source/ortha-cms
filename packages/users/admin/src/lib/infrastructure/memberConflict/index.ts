import { HTTP_STATUS, type ApiError } from '@orthacms/utils-admin';

/**
 * The machine-readable part of a users-API `409`: its `code` (one of the
 * server's `MEMBER_ERROR_CODES`) and whatever detail that code carries — the
 * wait of a cooldown, the addresses a batch invite collided with.
 */
export type MemberConflict = {
    /** e.g. `INVITE_RECENTLY_SENT`, `EMAIL_TAKEN`, `LAST_ADMIN_PROTECTED`. */
    code: string | null;
    /** Seconds until a cooldown lifts, when the code is a cooldown. */
    retryAfterSeconds: number | null;
    /** The colliding addresses of a batch invite, lower-cased. */
    emails: string[];
};

/**
 * Reads a `409`'s body, or `null` for any other failure. Never throws: a body
 * that is not the shape the server documents reads as a conflict with no code,
 * which the caller treats as the generic case.
 */
export function memberConflictOf(
    error: ApiError | null
): MemberConflict | null {
    if (!error || error.status !== HTTP_STATUS.CONFLICT) {
        return null;
    }
    const body = (error.details ?? {}) as {
        code?: unknown;
        retryAfterSeconds?: unknown;
        emails?: unknown;
    };
    return {
        code: typeof body.code === 'string' ? body.code : null,
        retryAfterSeconds:
            typeof body.retryAfterSeconds === 'number'
                ? body.retryAfterSeconds
                : null,
        emails: Array.isArray(body.emails)
            ? body.emails
                  .filter((item): item is string => typeof item === 'string')
                  .map((item) => item.toLowerCase())
            : []
    };
}
