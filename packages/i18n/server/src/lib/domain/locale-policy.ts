import { UnknownLocaleError } from './errors';
import type { Locale } from './value-objects/locale';
import type { LocaleSet } from './value-objects/locale-set';

/**
 * The locale **domain policy** — the pure fallback-chain and publish rules of
 * the i18n context, framework- and database-free so they can be unit-tested
 * without any content plumbing. It reads a {@link LocaleSet}; it renders no
 * SQL. The extension adapter's `listScope` builds the equivalent query, but
 * the *rule* it encodes lives here as the single source of truth.
 */
export class LocalePolicy {
    constructor(private readonly locales: LocaleSet) {}

    /**
     * Resolve a request's locale slug: absent → the default locale; unknown →
     * {@link UnknownLocaleError}. The uniform gate every request-facing path
     * funnels through.
     */
    resolve(slug: string | undefined): Locale {
        if (slug === undefined) return this.locales.default();
        const locale = this.locales.get(slug);
        if (!locale) throw new UnknownLocaleError(slug);
        return locale;
    }

    /**
     * Whether a `localeFallback=default` list should **widen** to the default
     * locale's rows: true only when default fallback is requested *and* the
     * requested locale isn't already the default (nothing to widen to
     * otherwise). The pure form of the extension's `listScope` strict-vs-widen
     * branch.
     */
    shouldWidenToDefault(requested: Locale, fallbackRequested: boolean): boolean {
        return fallbackRequested && !requested.equals(this.locales.default());
    }

    /**
     * The ordered locales to try when reading a translation group in
     * `requested`: `[requested]` in strict mode, or `[requested, default]` when
     * default fallback applies ({@link shouldWidenToDefault}).
     */
    fallbackChain(requested: Locale, fallbackRequested: boolean): Locale[] {
        return this.shouldWidenToDefault(requested, fallbackRequested)
            ? [requested, this.locales.default()]
            : [requested];
    }

    /**
     * The locales that must hold a row before a translation group is
     * considered fully published: the **default locale is always required** —
     * a group can't go live without its canonical translation. A pure rule the
     * publish flow can consult; the group's own per-sibling validation stays in
     * the extension adapter.
     */
    requiredLocalesForPublish(): Locale[] {
        return [this.locales.default()];
    }
}
