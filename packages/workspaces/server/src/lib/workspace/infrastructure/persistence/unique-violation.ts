/** Postgres `unique_violation`. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether `error` is Postgres rejecting a write for violating `constraint`.
 *
 * Drizzle wraps the driver error, so the `code`/`constraint` fields sit on a
 * `cause` rather than on the thrown object — and the nesting depth is an
 * implementation detail of the driver, so this walks the chain instead of
 * reaching for one fixed level.
 *
 * This is how a **read-then-write** uniqueness check gets its missing half. The
 * pre-check that runs before the insert is racy by construction: two requests
 * both read "free" and both proceed. The unique index is the only real
 * arbiter — so the loser has to be recognised here and turned back into the
 * same domain error the pre-check would have raised, or it escapes as a 500 for
 * what is an ordinary, expected collision.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
    let current: unknown = error;
    const seen = new Set<unknown>();

    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const candidate = current as {
            code?: unknown;
            constraint?: unknown;
            cause?: unknown;
        };
        if (
            candidate.code === UNIQUE_VIOLATION &&
            candidate.constraint === constraint
        ) {
            return true;
        }
        current = candidate.cause;
    }

    return false;
}
