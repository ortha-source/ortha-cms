import {
    inferLocaleDir,
    LOCALE_DIR,
    LOCALE_SLUG_MAX_LENGTH,
    LOCALE_SLUG_RE,
    type LocaleDir
} from '../../i18n.constants';
import { InvalidLocaleError } from '../errors';

/** The primitive shape a {@link Locale} is built from (the plugin's config). */
export interface LocaleInput {
    /** Machine slug stored on entry rows (e.g. `en`, `de`, `pt-br`). */
    slug: string;
    /** Human display name (e.g. "English"). */
    name: string;
    /** Whether this is the default locale. */
    isDefault?: boolean;
    /**
     * Text direction of content written in this locale. Optional in config —
     * omitted, it is **inferred from the slug** (`ar`, `he`, `fa`, … → `rtl`),
     * so a host adding an RTL language gets the right answer without saying so.
     * Declare it to override the inference (a transliterated variant, say).
     */
    dir?: LocaleDir;
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
        private readonly _isDefault: boolean,
        private readonly _dir: LocaleDir
    ) {}

    /**
     * Builds a {@link Locale}, rejecting a malformed slug, a blank name, or a
     * `dir` that is neither `ltr` nor `rtl` with {@link InvalidLocaleError}
     * (the plugin factory surfaces it at construction, request paths as HTTP
     * 400). An omitted `dir` is inferred from the slug rather than assumed
     * `ltr`, so configuring an RTL language is one line and not a silent
     * accessibility failure.
     */
    static create(input: LocaleInput): Locale {
        const { slug, name, isDefault, dir } = input;
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
        if (dir !== undefined && !LOCALE_DIR.includes(dir)) {
            throw new InvalidLocaleError(
                `Locale "${slug}" has an invalid dir "${dir}" — ` +
                    `expected ${LOCALE_DIR.map((d) => `"${d}"`).join(' or ')}.`
            );
        }
        return new Locale(
            slug,
            name,
            isDefault ?? false,
            dir ?? inferLocaleDir(slug)
        );
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

    /**
     * Text direction of content in this locale — always resolved (declared or
     * inferred), never undefined, so a consumer can set `dir` unconditionally
     * instead of guessing.
     */
    get dir(): LocaleDir {
        return this._dir;
    }

    /** Structural equality on the slug. */
    equals(other: Locale): boolean {
        return this._slug === other._slug;
    }
}
