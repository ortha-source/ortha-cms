import { defineMessages, useIntl } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@ortha-cms/design-system';
import type { EntrySlotContext } from '@ortha-cms/content-admin';
import { LOCALE_PARAM } from '../../constants';
import { localeName, resolveActiveLocale } from '../../domain/localePolicy';
import { useLocales } from '../../api/useLocales';

const messages = defineMessages({
    label: {
        id: 'i18n.title.currentLocale',
        defaultMessage: 'Current locale: {name}'
    }
});

/**
 * A static chip beside the entry-editor title showing which **locale** the open
 * record is in — the uppercased code and display name (e.g. `EN · English`).
 * Contributed into the content library's title-row slot; renders nothing for a
 * non-i18n type or before the locales have loaded. The current locale is
 * resolved the same way the {@link LocaleWidget} does: the saved entry's locale,
 * else the `?locale=` param, else the default.
 */
export function LocaleTitleChip({ schema, entry }: EntrySlotContext) {
    const intl = useIntl();
    const [searchParams] = useSearchParams();
    const { locales, defaultLocale } = useLocales();

    if (!schema.i18n || locales.length === 0) return null;

    const slug = resolveActiveLocale({
        entryLocale: entry?.locale,
        urlLocale: searchParams.get(LOCALE_PARAM) ?? undefined,
        defaultSlug: defaultLocale?.slug
    });
    if (!slug) return null;

    const name = localeName(locales, slug);

    return (
        <Badge
            variant="outline"
            aria-label={intl.formatMessage(messages.label, {
                name: name ?? slug
            })}
        >
            {slug.toUpperCase()}
            {name ? ` · ${name}` : null}
        </Badge>
    );
}
