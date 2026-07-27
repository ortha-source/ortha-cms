import { defineMessages, useIntl } from 'react-intl';
import type { EntryRecord } from '../../../../../../domain/types/contentType';
import { EntryStatusBadge } from '../../../../EntryStatusBadge';
import { EntrySidebarRow } from '../../../../EntrySidebarRow';
import { EntrySidebarSection } from '../../../../EntrySidebarSection';

const messages = defineMessages({
    detailsTitle: {
        id: 'content.sidebar.detailsTitle',
        defaultMessage: 'Details'
    },
    status: { id: 'content.sidebar.status', defaultMessage: 'Status' },
    created: { id: 'content.sidebar.created', defaultMessage: 'Created' },
    updated: { id: 'content.sidebar.updated', defaultMessage: 'Last updated' },
    entryId: { id: 'content.sidebar.entryId', defaultMessage: 'Entry ID' },
    empty: { id: 'content.sidebar.empty', defaultMessage: '—' }
});

/**
 * The static **Details** section of the entry editor's right rail: the entry's
 * publish status (the shared {@link EntryStatusBadge}), created / last-updated
 * timestamps, and its id.
 */
export function DetailsBlock({
    entry,
    isCreate
}: {
    entry?: EntryRecord;
    isCreate: boolean;
}) {
    const intl = useIntl();
    const dash = intl.formatMessage(messages.empty);

    const fmt = (iso?: string) =>
        iso
            ? intl.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })
            : dash;

    return (
        <EntrySidebarSection title={intl.formatMessage(messages.detailsTitle)}>
            <dl className="flex flex-col gap-3">
                <EntrySidebarRow label={intl.formatMessage(messages.status)}>
                    <EntryStatusBadge entry={entry} isCreate={isCreate} />
                </EntrySidebarRow>
                <EntrySidebarRow label={intl.formatMessage(messages.created)}>
                    {fmt(entry?.createdAt)}
                </EntrySidebarRow>
                <EntrySidebarRow label={intl.formatMessage(messages.updated)}>
                    {fmt(entry?.updatedAt)}
                </EntrySidebarRow>
                <EntrySidebarRow
                    label={intl.formatMessage(messages.entryId)}
                    stacked
                >
                    <span className="break-all font-mono text-xs text-muted-foreground">
                        {entry?.id ?? dash}
                    </span>
                </EntrySidebarRow>
            </dl>
        </EntrySidebarSection>
    );
}
