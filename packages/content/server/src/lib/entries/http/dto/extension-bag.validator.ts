import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Most extension keys one save may carry.
 *
 * A key names an installed plugin, so the real ceiling is single digits; this is
 * a guard against a client posting an object with thousands of keys, each of
 * which the registry would otherwise walk on every write. Deliberately not a
 * bound on the *values* — those are the extensions' own contracts, and
 * content-server declares the bag opaque.
 */
export const MAX_EXTENSION_KEYS = 16;

/** Rejects an extension bag with more keys than {@link MAX_EXTENSION_KEYS}. */
export function MaxExtensionKeys(options?: ValidationOptions) {
    return function (target: object, propertyName: string): void {
        registerDecorator({
            name: 'maxExtensionKeys',
            target: target.constructor,
            propertyName,
            options,
            validator: {
                validate(value: unknown) {
                    if (value === undefined || value === null) return true;
                    if (typeof value !== 'object' || Array.isArray(value)) {
                        // `@IsObject()` owns that message; saying it twice
                        // would put two sentences about one field in the 400.
                        return true;
                    }
                    return (
                        Object.keys(value as object).length <=
                        MAX_EXTENSION_KEYS
                    );
                },
                defaultMessage() {
                    return `extensions may name at most ${MAX_EXTENSION_KEYS} plugins`;
                }
            }
        });
    };
}
