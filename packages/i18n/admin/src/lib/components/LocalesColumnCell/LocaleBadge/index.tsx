import { defineMessages, useIntl } from 'react-intl';
import { Link } from 'react-router-dom';
import { Badge } from '@ortha-cms/design-system';
import {
    entryStatusView,
    ENTRY_STATUS_VIEW_VARIANT
} from '@ortha-cms/content-admin';
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
 * that row's publish state via the shared classifier — so a locale carrying
 * unpublished edits over live content reads *modified* (amber) rather than
 * being lumped in with a plain draft. Links to that locale's own editor.
 */
export function LocaleBadge({
    item,
    typePath
}: {
    item: LocaleSummaryItem;
    typePath: string;
}) {
    const intl = useIntl();
    // The badge shows the locale slug, so the state has to reach a screen reader
    // through the link's name — the tint alone conveys nothing.
    const view = entryStatusView(item);
    return (
        <Link
            to={`${typePath}/${item.entryId}`}
            aria-label={intl.formatMessage(
                item.status ? messages.open : messages.openNoStatus,
                { locale: item.locale, status: view }
            )}
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <Badge
                variant={ENTRY_STATUS_VIEW_VARIANT[view]}
                className="uppercase"
            >
                {item.locale}
            </Badge>
        </Link>
    );
}
