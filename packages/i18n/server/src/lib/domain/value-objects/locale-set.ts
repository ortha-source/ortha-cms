import { InvalidLocaleSetError } from '../errors';
import { Locale, type LocaleInput } from './locale';

/**
 * The configured set of {@link Locale}s — the value object that owns the
 * **collection invariants** no single locale can guard: a non-empty set,
 * unique slugs, and **exactly one default**. Because construction guarantees a
 * default member, {@link default} never returns undefined, and {@link remove}
 * refuses to drop the default. Preserves config (display) order.
 */
export class LocaleSet {
    private readonly bySlug: Map<string, Locale>;
    private readonly _default: Locale;

    private constructor(private readonly locales: readonly Locale[]) {
        this.bySlug = new Map(locales.map((locale) => [locale.slug, locale]));
        // `create` guarantees exactly one; the guard is for type flow.
        const fallback = locales.find((locale) => locale.isDefault);
        if (!fallback) {
            throw new InvalidLocaleSetError('A locale set has no default.');
        }
        this._default = fallback;
    }

    /**
     * Builds a {@link LocaleSet} from already-validated {@link Locale}s,
     * enforcing the collection invariants ({@link InvalidLocaleSetError} on a
     * violation).
     */
    static create(locales: readonly Locale[]): LocaleSet {
        if (locales.length === 0) {
            throw new InvalidLocaleSetError(
                'A locale set requires at least one locale.'
            );
        }
        const seen = new Set<string>();
        for (const locale of locales) {
            if (seen.has(locale.slug)) {
                throw new InvalidLocaleSetError(
                    `Duplicate locale slug "${locale.slug}".`
                );
            }
            seen.add(locale.slug);
        }
        const defaults = locales.filter((locale) => locale.isDefault);
        if (defaults.length !== 1) {
            throw new InvalidLocaleSetError(
                `Exactly one locale must set isDefault (got ${defaults.length}).`
            );
        }
        return new LocaleSet(locales);
    }

    /**
     * Builds a {@link LocaleSet} from the plugin's raw config defs — validating
     * each locale's format ({@link Locale.create}) then the collection. The one
     * entry point the plugin factory uses, so every locale rule lives here.
     */
    static fromDefs(defs: readonly LocaleInput[]): LocaleSet {
        return LocaleSet.create(defs.map((def) => Locale.create(def)));
    }

    /** All configured locales, in config (display) order. */
    all(): Locale[] {
        return [...this.locales];
    }

    /** One locale by slug, or undefined. */
    get(slug: string): Locale | undefined {
        return this.bySlug.get(slug);
    }

    /** Whether `slug` names a configured locale. */
    has(slug: string): boolean {
        return this.bySlug.has(slug);
    }

    /** The default locale (exactly one exists). */
    default(): Locale {
        return this._default;
    }

    /**
     * The set with `slug` removed — guarding that only a **member** can be
     * removed and that the **default is never removed** (either throws
     * {@link InvalidLocaleSetError}).
     */
    remove(slug: string): LocaleSet {
        const target = this.bySlug.get(slug);
        if (!target) {
            throw new InvalidLocaleSetError(
                `Locale "${slug}" is not a member.`
            );
        }
        if (target.isDefault) {
            throw new InvalidLocaleSetError(
                `Cannot remove the default locale "${slug}".`
            );
        }
        return LocaleSet.create(
            this.locales.filter((locale) => locale.slug !== slug)
        );
    }
}
