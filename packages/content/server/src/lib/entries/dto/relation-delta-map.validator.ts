import {
    registerDecorator,
    ValidatorConstraint,
    type ValidationOptions,
    type ValidatorConstraintInterface
} from 'class-validator';

/** RFC-4122 uuid (any version), matched case-insensitively. */
const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A key is valid when absent or an array of uuid strings. */
function isUuidArray(value: unknown): boolean {
    return (
        value === undefined ||
        (Array.isArray(value) &&
            value.every((id) => typeof id === 'string' && UUID_RE.test(id)))
    );
}

/**
 * Validates the `relations` bag of {@link SaveEntryDto}: a map from field name to
 * `{ link?, unlink?, order? }`, each an array of uuid strings. class-validator
 * can't decorate a `Record`'s dynamic keys, so this constraint checks the shape
 * of every value — turning a malformed delta (a non-array `unlink`, a non-uuid
 * id) into a clean **400** instead of letting it reach `inArray(...)` against a
 * `uuid` column and surface as a 500.
 */
@ValidatorConstraint({ name: 'relationDeltaMap' })
export class RelationDeltaMapConstraint
    implements ValidatorConstraintInterface
{
    validate(value: unknown): boolean {
        if (value === null || typeof value !== 'object') return false;
        return Object.values(value as Record<string, unknown>).every(
            (delta) => {
                if (delta === null || typeof delta !== 'object') return false;
                const { link, unlink, order } = delta as Record<
                    string,
                    unknown
                >;
                return (
                    isUuidArray(link) &&
                    isUuidArray(unlink) &&
                    isUuidArray(order)
                );
            }
        );
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
