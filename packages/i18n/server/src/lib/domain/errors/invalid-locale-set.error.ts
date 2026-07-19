/**
 * Raised by {@link LocaleSet} when the *collection* of locales violates an
 * invariant no single {@link Locale} can guard — an empty set, a duplicate
 * slug, not exactly one default, or removing the default. Transport-agnostic;
 * the plugin factory surfaces it at construction.
 */
export class InvalidLocaleSetError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidLocaleSetError';
    }
}
