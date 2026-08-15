/**
 * The client-side **locale policy** — the small set of pure locale rules the
 * i18n widgets share, mirroring the server's `LocalePolicy` so the UI and the
 * API agree on which locale is "current" and how a locale maps onto the
 * `?locale=` URL param. Framework-free (no React, no router) so the switcher,
 * the title chip, and the editor widget resolve one rule instead of each
 * re-inlining the same `?? ` chain.
 */

import type { Locale, LocaleDir } from '../../types/locale';

/** Inputs to {@link resolveActiveLocale}, in precedence order (highest first). */
export type ActiveLocaleSources = {
    /** The saved entry's own locale (edit mode). */
    entryLocale?: string;
    /** The `?locale=` URL param (create mode / list scoping). */
    urlLocale?: string;
    /** The configured default locale's slug. */
    defaultSlug?: string;
};

/** An empty/blank slug is "absent", not a locale named `''`. */
function present(slug: string | undefined): string | undefined {
    const trimmed = slug?.trim();
    return trimmed ? trimmed : undefined;
}

/**
 * The active content locale, resolved by the same precedence the server's
 * `LocalePolicy.resolve` uses: the saved entry's locale, else the URL
 * `?locale=`, else the default. `undefined` only before the locales have
 * loaded (no default yet).
 *
 * Each source is **blank-checked** rather than nullish-checked: `?locale=`
 * yields `''`, which is not nullish, so a plain `??` chain would resolve the
 * active locale to the empty string and stop the default from applying.
 */
export function resolveActiveLocale(
    sources: ActiveLocaleSources
): string | undefined {
    return (
        present(sources.entryLocale) ??
        present(sources.urlLocale) ??
        present(sources.defaultSlug)
    );
}

/**
 * The configured locale with `slug`, or `undefined` when the slug names none —
 * a typo in the URL, or a locale dropped from the host config while rows in it
 * still exist.
 *
 * Callers must **not** silently substitute the default for a miss: the request
 * still carries the unknown slug (the server 400s it), so a control reporting
 * the default would be describing a list it is not showing.
 */
export function findLocale(
    locales: Locale[],
    slug: string | undefined
): Locale | undefined {
    return slug ? locales.find((locale) => locale.slug === slug) : undefined;
}

/** Whether `slug` is the configured default locale. */
export function isDefaultLocale(
    slug: string | undefined,
    defaultSlug: string | undefined
): boolean {
    return slug !== undefined && slug === defaultSlug;
}

/**
 * The `?locale=` value to write for `slug`: `undefined` for the default locale
 * — a clean URL, since the server scopes to the default when the param is
 * absent, so the two spellings can't drift — and the slug itself otherwise.
 */
export function toLocaleListParam(
    slug: string,
    defaultSlug: string | undefined
): string | undefined {
    return isDefaultLocale(slug, defaultSlug) ? undefined : slug;
}

/** The display name of the locale with `slug`, or `undefined` if unknown. */
export function localeName(
    locales: Locale[],
    slug: string | undefined
): string | undefined {
    return findLocale(locales, slug)?.name;
}

/**
 * The writing direction of the locale with `slug`, or `undefined` if unknown.
 *
 * The server resolves direction (explicit config, else inferred from the tag),
 * so this is a lookup, never a guess — the admin must not keep its own list of
 * which languages are right-to-left.
 */
export function localeDir(
    locales: Locale[],
    slug: string | undefined
): LocaleDir | undefined {
    return findLocale(locales, slug)?.dir;
}

/**
 * The `lang`/`dir` pair to put on a region rendering content **in** `slug`.
 *
 * `slug` is a BCP-47 tag by contract, so it is the `lang` value verbatim.
 * Spreading the result onto an element is the whole API: an unknown slug
 * yields `{}` rather than a wrong language, and a locale whose direction has
 * not loaded yet yields `lang` alone rather than a wrong direction.
 */
export function localeAttrs(
    locales: Locale[],
    slug: string | undefined
): { lang?: string; dir?: LocaleDir } {
    if (!slug) return {};
    const dir = localeDir(locales, slug);
    return dir ? { lang: slug, dir } : { lang: slug };
}
