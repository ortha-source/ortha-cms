import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    SegmentedControl,
    SegmentedControlItem
} from '@orthacms/design-system';
import { DrillRecordRow, SignalDrill } from '@orthacms/insights-admin';
import { useContentStaleRecords } from '../../../application/useContentInsights';
import type { StaleAge } from '../../../infrastructure/contentInsightsGateway';
import { insightsRecordLink } from '../../insightsRecordsLink';
import { InsightsRecordsActions } from '../InsightsRecordsActions';

/** Intl descriptors for the "Gone quiet" panel, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.drill.stale.title',
        defaultMessage: 'Gone quiet'
    },
    description: {
        id: 'content.insights.drill.stale.description',
        defaultMessage:
            'Published records by how long since anyone edited them, the oldest first.'
    },
    ages: {
        id: 'content.insights.drill.stale.ages',
        defaultMessage: 'Last edited'
    },
    recent: {
        id: 'content.insights.drill.stale.recent',
        defaultMessage: '30–90 days'
    },
    months: {
        id: 'content.insights.drill.stale.months',
        defaultMessage: '3–12 months'
    },
    year: {
        id: 'content.insights.drill.stale.year',
        defaultMessage: 'Over a year'
    },
    meta: {
        id: 'content.insights.drill.stale.meta',
        defaultMessage: '{type} · last edited {date}'
    },
    untitled: {
        id: 'content.insights.drill.stale.untitled',
        defaultMessage: 'Untitled ({id})'
    },
    empty: {
        id: 'content.insights.drill.stale.empty',
        defaultMessage: 'Nothing published has gone this quiet.'
    }
});

/** The bands, in the order the control offers them. */
const AGES: StaleAge[] = ['recent', 'months', 'year'];

/**
 * The records behind "Gone quiet": published records by how long since anyone
 * touched them, oldest first, with who touched them last. Opens on **Over a
 * year** — the band the line counts — and the other two are one press away.
 */
export function StaleEntriesDrill() {
    const intl = useIntl();
    const [age, setAge] = useState<StaleAge>('year');
    const { data, isPending, isError } = useContentStaleRecords(age);

    return (
        <SignalDrill
            title={intl.formatMessage(messages.title)}
            count={data?.total}
            shown={data?.records.length}
            description={intl.formatMessage(messages.description)}
            filter={
                <SegmentedControl
                    variant="muted"
                    className="self-start"
                    value={age}
                    onValueChange={(next) => {
                        // Radix clears the value on a re-press of the lit one.
                        if (next) setAge(next as StaleAge);
                    }}
                    aria-label={intl.formatMessage(messages.ages)}
                >
                    {AGES.map((option) => (
                        <SegmentedControlItem key={option} value={option}>
                            {intl.formatMessage(messages[option])}
                        </SegmentedControlItem>
                    ))}
                </SegmentedControl>
            }
            isPending={isPending}
            isError={isError}
            isEmpty={!!data && data.total === 0}
            emptyMessage={intl.formatMessage(messages.empty)}
            actions={
                data ? (
                    <InsightsRecordsActions
                        types={data.types}
                        filter={{ kind: 'stale', age }}
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
