/**
 * Postgres error introspection shared by services that map constraint
 * violations to clean HTTP errors (e.g. a unique-index race settled by the
 * constraint → 409) instead of leaking a 500.
 */

/** Postgres error code for a unique constraint/index violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * Whether an error (or its `cause`, where a driver/ORM wraps it) is a
 * Postgres unique violation (`23505`). Drivers surface the SQLSTATE on a
 * `code` property; the walk is defensive because Drizzle has wrapped driver
 * errors differently across versions.
 */
export function isUniqueViolation(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; current && depth < 5; depth += 1) {
        if (
            typeof current === 'object' &&
            'code' in current &&
            (current as { code?: unknown }).code === UNIQUE_VIOLATION
        ) {
            return true;
        }
        current =
            typeof current === 'object' && 'cause' in current
                ? (current as { cause?: unknown }).cause
                : undefined;
    }
    return false;
}
