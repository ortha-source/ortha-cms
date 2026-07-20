import {
    registerDecorator,
    ValidatorConstraint,
    type ValidationOptions,
    type ValidatorConstraintInterface
} from 'class-validator';

/** RFC-4122 uuid (any version), matched case-insensitively. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The only keys a per-field delta may carry. */
const DELTA_KEYS = ['link', 'unlink', 'order'] as const;

/**
 * Max ids in any one `link`/`unlink`/`order` array. The read side is already
 * clamped (`pageSize ≤ MAX_PAGE_SIZE`); this bounds the write side so a single
 * save can't carry an unbounded id array — which would fan out into a huge
 * `inArray(...)` probe or a one-`WHEN`-per-id `CASE` reorder. Generous enough
 * for a realistic drag-reorder of a scrolled-open relation, finite enough to
 * reject a pathological payload.
 */
const MAX_DELTA_IDS = 1000;

/** Max relation fields one save may touch (a bound on the map's key count). */
const MAX_DELTA_FIELDS = 100;

/**
 * A key is valid when absent or an array of at most {@link MAX_DELTA_IDS} uuid
 * strings.
 */
function isUuidArray(value: unknown): boolean {
    return (
        value === undefined ||
        (Array.isArray(value) &&
            value.length <= MAX_DELTA_IDS &&
            value.every((id) => typeof id === 'string' && UUID_RE.test(id)))
    );
}

/**
 * Validates the `relations` bag of {@link SaveEntryDto}: a map from field name to
 * `{ link?, unlink?, order? }`, each an array of uuid strings. class-validator
 * can't decorate a `Record`'s dynamic keys, so this constraint checks the shape
 * of every value — turning a malformed delta (a non-array `unlink`, a non-uuid
 * id, an unknown inner key, or an over-large array) into a clean **400** instead
 * of letting it reach `inArray(...)` against a `uuid` column and surface as a
 * 500. Unknown inner keys are rejected so the nested `Record` can't slip past
 * the app's `forbidNonWhitelisted` posture, and the id arrays and the map itself
 * are size-bounded so a single request can't carry an unbounded payload.
 */
@ValidatorConstraint({ name: 'relationDeltaMap' })
export class RelationDeltaMapConstraint
    implements ValidatorConstraintInterface
{
    validate(value: unknown): boolean {
        if (value === null || typeof value !== 'object') return false;
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length > MAX_DELTA_FIELDS) return false;
        return entries.every(([, delta]) => {
            if (delta === null || typeof delta !== 'object') return false;
            const record = delta as Record<string, unknown>;
            // Reject any key beyond link/unlink/order — the nested Record isn't
            // reached by the global whitelist pipe, so enforce it here.
            if (
                Object.keys(record).some(
                    (key) =>
                        !(DELTA_KEYS as readonly string[]).includes(key)
                )
            )
                return false;
            return (
                isUuidArray(record['link']) &&
                isUuidArray(record['unlink']) &&
                isUuidArray(record['order'])
            );
        });
    }

    defaultMessage(): string {
        return 'relations must map each field to { link?, unlink?, order? } arrays of uuids';
    }
}

/** Property decorator applying {@link RelationDeltaMapConstraint}. */
export function IsRelationDeltaMap(options?: ValidationOptions) {
    return (object: object, propertyName: string): void =>
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            validator: RelationDeltaMapConstraint
        });
}
