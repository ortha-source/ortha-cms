import { defineMessages, useIntl } from 'react-intl';
import type { RecordsColumnCellContext } from '@ortha-cms/content-admin';
import type { LocaleSummariesData } from '../../api/useLocaleSummaries';
import { LocaleBadge } from './LocaleBadge';

const messages = defineMessages({
    loading: { id: 'i18n.column.loading', defaultMessage: '…' }
});

/**
 * The records table's **Locales** cell: one status-tinted badge per live
 * locale of the row's translation group, each linking to that locale's
 * editor. Data arrives batched per page via the column item's `useRowsData`
 * ({@link useLocaleSummaries}) — never a request per row.
 */
export function LocalesColumnCell({
    entry,
    data,
    typePath
}: RecordsColumnCellContext) {
    const intl = useIntl();
    const summaries = data as LocaleSummariesData | undefined;
    if (!entry.localeGroupId) return null;
    if (!summaries || summaries.isPending) {
        return (
            <span className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.loading)}
            </span>
        );
    }
    const members = summaries.groups[entry.localeGroupId] ?? [];
    return (
        <span className="flex flex-wrap items-center gap-1">
            {members.map((member) => (
                <LocaleBadge
                    key={member.locale}
                    item={member}
                    typePath={typePath}
                />
            ))}
        </span>
    );
}
