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
    return violatedConstraint(error) !== undefined;
}

/**
 * The **name of the index/constraint** a unique violation (`23505`) tripped, or
 * `undefined` when the error is not one.
 *
 * A table can carry several unique indexes, and "which one" is the difference
 * between two entirely different messages to the caller — a localized content
 * table has both a `(locale_group_id, locale)` pair and a per-locale one-to-one
 * relation index, and reporting either as the other tells the user to fix
 * something that is not wrong. Postgres names the offender on `constraint`;
 * the same defensive `cause` walk as {@link isUniqueViolation} finds it through
 * whatever the driver/ORM wrapped it in.
 *
 * Returns `''` for a violation whose constraint the driver did not name, so a
 * caller can still distinguish "a unique violation, unattributed" from "not a
 * unique violation" without a second call.
 */
export function violatedConstraint(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; current && depth < 5; depth += 1) {
        if (
            typeof current === 'object' &&
            'code' in current &&
            (current as { code?: unknown }).code === UNIQUE_VIOLATION
        ) {
            const name = (current as { constraint?: unknown }).constraint;
            return typeof name === 'string' ? name : '';
        }
        current =
            typeof current === 'object' && 'cause' in current
                ? (current as { cause?: unknown }).cause
                : undefined;
    }
    return undefined;
}
