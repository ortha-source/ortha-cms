import {
    registerDecorator,
    ValidatorConstraint,
    type ValidationOptions,
    type ValidatorConstraintInterface
} from 'class-validator';
import {
    VIEW_EXTRA_MAX_LENGTH,
    VIEW_MAX_EXTRA_KEYS
} from '../../views.constants';

/**
 * Validates a payload's `extra` bag: the slot-owned list params (the i18n
 * plugin's `?locale=`, and whatever a later plugin contributes) as a flat
 * string map.
 *
 * class-validator cannot decorate a `Record`'s dynamic keys, and the keys here
 * are genuinely dynamic — they come from `RECORDS_TOOLBAR_SLOT.listParamKeys`
 * at runtime, so naming them in a DTO would silently break the next plugin's
 * params. What we can still enforce is the shape and a bound: flat, strings on
 * both sides, and small. That turns a malformed bag into a clean 400 instead of
 * a jsonb column quietly swallowing a nested object nothing can replay.
 */
@ValidatorConstraint({ name: 'viewExtraParams' })
export class ViewExtraParamsConstraint implements ValidatorConstraintInterface {
    validate(value: unknown): boolean {
        if (value === null || typeof value !== 'object') return false;
        if (Array.isArray(value)) return false;
        const entries = Object.entries(value as Record<string, unknown>);
        if (entries.length > VIEW_MAX_EXTRA_KEYS) return false;
        return entries.every(
            ([key, param]) =>
                key.length > 0 &&
                key.length <= VIEW_EXTRA_MAX_LENGTH &&
                typeof param === 'string' &&
                param.length <= VIEW_EXTRA_MAX_LENGTH
        );
    }

    defaultMessage(): string {
        return `extra must be a flat map of at most ${VIEW_MAX_EXTRA_KEYS} string values, each at most ${VIEW_EXTRA_MAX_LENGTH} characters`;
    }
}

/** Applies {@link ViewExtraParamsConstraint} to a property. */
export function IsViewExtraParams(options?: ValidationOptions) {
    return function (object: object, propertyName: string): void {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options,
            validator: ViewExtraParamsConstraint
        });
    };
}
