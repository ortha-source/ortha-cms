import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Badge } from '@ortha-cms/design-system';
import type { LocaleSummaryItem } from '../../../types/locale';

const messages = defineMessages({
    open: {
        id: 'i18n.column.openLocale',
        defaultMessage: 'Open the {locale} version ({status})'
    },
    openNoStatus: {
        id: 'i18n.column.openLocaleNoStatus',
        defaultMessage: 'Open the {locale} version'
    }
});

/**
 * One locale badge in the records table's Locales column: the slug, tinted by
 * the row's publish status (published = solid, draft = muted), linking to
 * that locale's own editor.
 */
export function LocaleBadge({
    item,
    typePath
}: {
    item: LocaleSummaryItem;
    typePath: string;
}) {
    const intl = useIntl();
    return (
        <Link
            to={`${typePath}/${item.entryId}`}
            aria-label={intl.formatMessage(
                item.status ? messages.open : messages.openNoStatus,
                { locale: item.locale, status: item.status }
            )}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <Badge
                variant={item.status === 'published' ? 'success' : 'secondary'}
                className="uppercase"
            >
                {item.locale}
            </Badge>
        </Link>
    );
}
