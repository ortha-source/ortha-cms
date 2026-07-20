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
