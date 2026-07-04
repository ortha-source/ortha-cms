/**
 * Shared string constants of the i18n admin plugin — URL params, API paths,
 * permissions, and slot item ids, so none live as magic literals.
 */

/** URL query param holding the active content locale. */
export const LOCALE_PARAM = 'locale';

/**
 * URL query param carrying the translation group a created row joins (a
 * sibling). Matches the server `SaveEntryDto.localeGroupId` body key, so the
 * entry-params slot forwards it straight into the create body.
 */
export const LOCALE_GROUP_PARAM = 'localeGroupId';

/** URL/list param widening a list to default-locale fallback. */
export const LOCALE_FALLBACK_PARAM = 'localeFallback';

/** The `localeFallback` value the server understands. */
export const LOCALE_FALLBACK_DEFAULT = 'default';

/** API path of the configured-locales read. */
export const LOCALES_PATH = '/i18n/locales';

/** API path prefix of the locale-domain content endpoints. */
export const I18N_CONTENT_PATH = '/i18n/content';

/** Permission required to create an entry (and thus a translation). */
export const CONTENT_CREATE = 'content:create';

/** Slot item ids (also React keys) for this plugin's contributions. */
export const SLOT_ITEM_ID = {
    Switcher: 'i18n.localeSwitcher',
    Column: 'i18n.localesColumn',
    Widget: 'i18n.localeWidget',
    FilterFields: 'i18n.filterFields',
    EntryParams: 'i18n.entryParams'
} as const;

/** Virtual filter field ids — must match the server extension's names. */
export const LOCALE_FILTER_FIELD = {
    HasLocale: 'hasLocale',
    MissingLocale: 'missingLocale',
    LocaleCount: 'localeCount'
} as const;
