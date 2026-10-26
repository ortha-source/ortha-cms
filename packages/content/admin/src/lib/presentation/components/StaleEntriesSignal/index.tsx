import { defineMessages, useIntl } from 'react-intl';
import { Clock } from 'lucide-react';
import {
    SignalRow,
    type InsightsSignalRowProps
} from '@orthacms/insights-admin';
import { useContentStale } from '../../../application/useContentInsights';

/** Intl descriptors for the "Gone quiet" line, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.signal.stale.title',
        defaultMessage: 'Gone quiet'
    },
    hint: {
        id: 'content.insights.signal.stale.hint',
        defaultMessage: 'Not touched in over a year'
    },
    hintMostIn: {
        id: 'content.insights.signal.stale.hintMostIn',
        defaultMessage: 'Not touched in over a year · most in {type}'
    }
});

/**
 * Published records nobody has edited in over a year — the chart's oldest
 * bucket, as a count somebody can act on, with the type most of them sit in.
 */
export function StaleEntriesSignal({ onOpen, isOpen }: InsightsSignalRowProps) {
    const intl = useIntl();
    const { data, isPending, isError } = useContentStale();

    const older =
        data?.buckets.find((bucket) => bucket.id === 'older')?.count ?? 0;
    const top = data?.olderTopType;

    return (
        <SignalRow
            icon={Clock}
            tone="bad"
            count={older}
            title={intl.formatMessage(messages.title)}
            hint={
                top && older > 0
                    ? intl.formatMessage(messages.hintMostIn, {
                          type: top.label
                      })
                    : intl.formatMessage(messages.hint)
            }
            isPending={isPending}
            isError={isError}
            onOpen={onOpen}
            isOpen={isOpen}
        />
    );
}
