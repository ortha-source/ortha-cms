import { LOCALE_SLUG_MAX_LENGTH, LOCALE_SLUG_RE } from '../../i18n.constants';
import { InvalidLocaleError } from '../errors';

/** The primitive shape a {@link Locale} is built from (the plugin's config). */
export interface LocaleInput {
    /** Machine slug stored on entry rows (e.g. `en`, `de`, `pt-br`). */
    slug: string;
    /** Human display name (e.g. "English"). */
    name: string;
    /** Whether this is the default locale. */
    isDefault?: boolean;
}

/**
 * A single configured locale — the value object that owns the **slug format
 * rule** (the lowercase BCP-47-ish shape that used to live inline on the
 * plugin factory) and a non-blank display name. Constructing one guarantees a
 * well-formed locale, so every other i18n path can handle a `Locale` instead
 * of a raw string it must re-validate.
 */
export class Locale {
    private constructor(
        private readonly _slug: string,
        private readonly _name: string,
        private readonly _isDefault: boolean
    ) {}

    /**
     * Builds a {@link Locale}, rejecting a malformed slug or a blank name with
     * {@link InvalidLocaleError} (the plugin factory surfaces it at
     * construction, request paths as HTTP 400).
     */
    static create(input: LocaleInput): Locale {
        const { slug, name, isDefault } = input;
        if (
            !LOCALE_SLUG_RE.test(slug) ||
            slug.length > LOCALE_SLUG_MAX_LENGTH
        ) {
            throw new InvalidLocaleError(
                `Locale slug "${slug}" is invalid — lowercase 2-3 letter ` +
                    `primary tag with optional "-" subtags (e.g. "en", "pt-br").`
            );
        }
        if (!name.trim()) {
            throw new InvalidLocaleError(`Locale "${slug}" has an empty name.`);
        }
        return new Locale(slug, name, isDefault ?? false);
    }

    /** The validated locale slug. */
    get slug(): string {
        return this._slug;
    }

    /** The display name. */
    get name(): string {
        return this._name;
    }

    /** Whether this is the default locale. */
    get isDefault(): boolean {
        return this._isDefault;
    }

    /** Structural equality on the slug. */
    equals(other: Locale): boolean {
        return this._slug === other._slug;
    }
}
