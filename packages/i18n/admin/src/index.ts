/** Public API of @ortha-cms/i18n-admin. */

export { I18nPlugin } from './lib/utils/i18nPlugin';
export type { I18nAdminPlugin } from './lib/utils/i18nPlugin';

export { useLocales } from './lib/api/useLocales';
export type {
    EntryLocaleItem,
    EntryLocalesResult,
    Locale,
    LocaleSummariesResult,
    LocaleSummaryItem,
    LocalesResult
} from './lib/types/locale';
