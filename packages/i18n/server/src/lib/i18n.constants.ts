/** Shared constants of the i18n server plugin. */

/**
 * Valid locale slugs: lowercase 2–3 letter primary tag, optional `-`-joined
 * alphanumeric subtags (`en`, `de`, `pt-br`, `zh-hans`).
 */
export const LOCALE_SLUG_RE = /^[a-z]{2,3}(-[a-z0-9]+)*$/;

/** Longest accepted locale slug (mirrors BCP-47's practical bound). */
export const LOCALE_SLUG_MAX_LENGTH = 35;

/** DI token for the validated {@link I18nPluginConfig}. */
export const I18N_CONFIG = Symbol('I18N_CONFIG');

/** Cap on `groupIds` per locale-summary batch request. */
export const LOCALE_SUMMARY_MAX_GROUPS = 100;

/** The `localeFallback` value that widens a list to the default locale. */
export const LOCALE_FALLBACK_DEFAULT = 'default';

/**
 * The two text directions a locale can declare — the values of the HTML `dir`
 * attribute a consumer sets on the editor surface, the preview, and the
 * published page (WCAG 1.3.2 Meaningful Sequence, 3.1.2 Language of Parts).
 */
export const LOCALE_DIR = ['ltr', 'rtl'] as const;

/** A configured locale's text direction. */
export type LocaleDir = (typeof LOCALE_DIR)[number];

/**
 * Script subtags that decide direction outright, whichever language carries
 * them — `sr-latn` is LTR and `az-arab` is RTL regardless of what the language
 * alone would imply. Checked before {@link RTL_LANGUAGE_SUBTAGS}, since an
 * explicit script is the more specific statement.
 */
const RTL_SCRIPT_SUBTAGS: ReadonlySet<string> = new Set([
    'adlm',
    'arab',
    'aran',
    'hebr',
    'nkoo',
    'rohg',
    'syrc',
    'thaa',
    'yezi'
]);

/** Script subtags that force LTR even on a language written RTL elsewhere. */
const LTR_SCRIPT_SUBTAGS: ReadonlySet<string> = new Set([
    'cyrl',
    'latn',
    'hans',
    'hant'
]);

/**
 * Primary language subtags written right-to-left. Deliberately a short,
 * conservative list of the languages a CMS is realistically configured with,
 * not a mirror of CLDR: it only supplies the **default** for a locale that
 * declares no `dir`, and a host with an exotic script says so explicitly.
 */
const RTL_LANGUAGE_SUBTAGS: ReadonlySet<string> = new Set([
    'ar', // Arabic
    'arc', // Aramaic
    'ckb', // Central Kurdish
    'dv', // Divehi
    'fa', // Persian
    'he', // Hebrew
    'ks', // Kashmiri
    'ku', // Kurdish
    'nqo', // N'Ko
    'ps', // Pashto
    'sd', // Sindhi
    'ug', // Uyghur
    'ur', // Urdu
    'yi' // Yiddish
]);

/**
 * The text direction implied by a locale slug, used when the host's config
 * declares none — so adding `{ slug: 'ar', name: 'العربية' }` yields an RTL
 * locale without the host having to know it, while an explicit `dir` always
 * wins.
 *
 * An explicit script subtag decides first (`az-arab` → `rtl`, `sr-latn` →
 * `ltr`); otherwise the primary language subtag does; otherwise `ltr`.
 */
export function inferLocaleDir(slug: string): LocaleDir {
    const parts = slug.toLowerCase().split('-');
    for (const part of parts.slice(1)) {
        if (RTL_SCRIPT_SUBTAGS.has(part)) return 'rtl';
        if (LTR_SCRIPT_SUBTAGS.has(part)) return 'ltr';
    }
    return RTL_LANGUAGE_SUBTAGS.has(parts[0]) ? 'rtl' : 'ltr';
}
