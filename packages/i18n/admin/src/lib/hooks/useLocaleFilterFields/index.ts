import { defineMessages } from 'react-intl';
import {
    FIELD_TYPE,
    type FilterEnumValue,
    type FilterField
} from '@ortha-cms/query-builder-admin';
import type { ContentTypeDetail } from '@ortha-cms/content-admin';
import { LOCALE_FILTER_FIELD } from '../../constants';
import { useLocales } from '../../api/useLocales';

const messages = defineMessages({
    hasLocale: {
        id: 'i18n.filter.hasLocale',
        defaultMessage: 'Has locale'
    },
    missingLocale: {
        id: 'i18n.filter.missingLocale',
        defaultMessage: 'Missing locale'
    },
    localeCount: {
        id: 'i18n.filter.localeCount',
        defaultMessage: 'Locale count'
    }
});

/**
 * The locale filter fields contributed to the records query-builder drawer
 * (via `RECORDS_FILTER_FIELDS_SLOT`): **Has locale** / **Missing locale**
 * (enums of the configured slugs) and **Locale count** (a number) — resolved
 * server-side by the i18n plugin's virtual-field subqueries, so "give me
 * every record missing its German translation" or "fewer than 3 locales" is
 * one saved filter. Empty for a non-i18n type (and until the locales load).
 */
export function useLocaleFilterFields(
    schema: ContentTypeDetail
): FilterField[] {
    const { locales } = useLocales();
    if (!schema.i18n || locales.length === 0) return [];
    const enumValues: FilterEnumValue[] = locales.map((locale) => ({
        value: locale.slug,
        label: {
            id: `i18n.filter.locale.${locale.slug}`,
            defaultMessage: locale.name
        }
    }));
    return [
        {
            id: LOCALE_FILTER_FIELD.HasLocale,
            label: messages.hasLocale,
            type: FIELD_TYPE.Enum,
            enumValues
        },
        {
            id: LOCALE_FILTER_FIELD.MissingLocale,
            label: messages.missingLocale,
            type: FIELD_TYPE.Enum,
            enumValues
        },
        {
            id: LOCALE_FILTER_FIELD.LocaleCount,
            label: messages.localeCount,
            type: FIELD_TYPE.Number
        }
    ];
}
