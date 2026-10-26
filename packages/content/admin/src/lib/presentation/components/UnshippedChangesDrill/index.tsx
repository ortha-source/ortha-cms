import { defineMessages, useIntl } from 'react-intl';
import { DrillRecordRow, SignalDrill } from '@orthacms/insights-admin';
import { useContentUnshippedRecords } from '../../../application/useContentInsights';
import { insightsRecordLink } from '../../insightsRecordsLink';
import { InsightsRecordsActions } from '../InsightsRecordsActions';

/** Intl descriptors for the "Waiting to go live" panel, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.drill.unshipped.title',
        defaultMessage: 'Waiting to go live'
    },
    description: {
        id: 'content.insights.drill.unshipped.description',
        defaultMessage:
            'Published records carrying edits nobody has published, the longest-waiting first.'
    },
    meta: {
        id: 'content.insights.drill.unshipped.meta',
        defaultMessage: '{type} · edited {date}'
    },
    untitled: {
        id: 'content.insights.drill.unshipped.untitled',
        defaultMessage: 'Untitled ({id})'
    },
    empty: {
        id: 'content.insights.drill.unshipped.empty',
        defaultMessage: 'Everything live is up to date.'
    }
});

/**
 * The records behind "Waiting to go live": each live record with pending
 * edits, the edit that has waited longest first, with who made it — and the
 * way out to the records table on its **Modified** chip.
 */
export function UnshippedChangesDrill() {
    const intl = useIntl();
    const { data, isPending, isError } = useContentUnshippedRecords();

    return (
        <SignalDrill
            title={intl.formatMessage(messages.title)}
            count={data?.total}
            shown={data?.records.length}
            description={intl.formatMessage(messages.description)}
            isPending={isPending}
            isError={isError}
            isEmpty={!!data && data.total === 0}
            emptyMessage={intl.formatMessage(messages.empty)}
            actions={
                data ? (
                    <InsightsRecordsActions
                        types={data.types}
                        filter={{ kind: 'modified' }}
                    />
                ) : null
            }
        >
            {data?.records.map((record) => (
                <DrillRecordRow
                    key={record.id}
                    to={insightsRecordLink(record.type, record.id)}
                    title={
                        record.title ??
                        intl.formatMessage(messages.untitled, {
                            id: record.id.slice(0, 8)
                        })
                    }
                    meta={intl.formatMessage(messages.meta, {
                        type: record.typeLabel,
                        date: intl.formatDate(record.updatedAt, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        })
                    })}
                    personId={record.editorId}
                />
            ))}
        </SignalDrill>
    );
}
