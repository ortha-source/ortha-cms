import { defineMessages, useIntl } from 'react-intl';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../../../domain/types/contentType';
import { EntryStatusBadge } from '../../../../EntryStatusBadge';
import { MetaRow } from './MetaRow';

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
 * The static **Details** card in the entry editor's right rail: the entry's id,
 * publish status (the shared {@link EntryStatusBadge}), and created /
 * last-updated timestamps.
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
        <Card className="border-border/60 bg-muted/20 shadow-none">
            <CardHeader>
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {intl.formatMessage(messages.detailsTitle)}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="flex flex-col gap-3">
                    <MetaRow label={intl.formatMessage(messages.entryId)} stacked>
                        <span className="break-all font-mono text-xs text-muted-foreground">
                            {entry?.id ?? dash}
                        </span>
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.status)}>
                        <EntryStatusBadge entry={entry} isCreate={isCreate} />
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.created)}>
                        {fmt(entry?.createdAt)}
                    </MetaRow>
                    <MetaRow label={intl.formatMessage(messages.updated)}>
                        {fmt(entry?.updatedAt)}
                    </MetaRow>
                </dl>
            </CardContent>
        </Card>
    );
}
