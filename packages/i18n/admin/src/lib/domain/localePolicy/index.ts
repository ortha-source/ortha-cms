/**
 * The client-side **locale policy** — the small set of pure locale rules the
 * i18n widgets share, mirroring the server's `LocalePolicy` so the UI and the
 * API agree on which locale is "current" and how a locale maps onto the
 * `?locale=` URL param. Framework-free (no React, no router) so the switcher,
 * the title chip, and the editor widget resolve one rule instead of each
 * re-inlining the same `?? ` chain.
 */

import type { Locale } from '../../types/locale';

/** Inputs to {@link resolveActiveLocale}, in precedence order (highest first). */
export type ActiveLocaleSources = {
    /** The saved entry's own locale (edit mode). */
    entryLocale?: string;
    /** The `?locale=` URL param (create mode / list scoping). */
    urlLocale?: string;
    /** The configured default locale's slug. */
    defaultSlug?: string;
};

/**
 * The active content locale, resolved by the same precedence the server's
 * `LocalePolicy.resolve` uses: the saved entry's locale, else the URL
 * `?locale=`, else the default. `undefined` only before the locales have
 * loaded (no default yet).
 */
export function resolveActiveLocale(
    sources: ActiveLocaleSources
): string | undefined {
    return sources.entryLocale ?? sources.urlLocale ?? sources.defaultSlug;
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
    return locales.find((locale) => locale.slug === slug)?.name;
}
