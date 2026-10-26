import { defineMessages, useIntl } from 'react-intl';
import { PencilLine } from 'lucide-react';
import {
    SignalRow,
    type InsightsSignalRowProps
} from '@orthacms/insights-admin';
import { useContentUnshipped } from '../../../application/useContentInsights';

/** Intl descriptors for the "Waiting to go live" line, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.signal.unshipped.title',
        defaultMessage: 'Waiting to go live'
    },
    hint: {
        id: 'content.insights.signal.unshipped.hint',
        defaultMessage:
            'Published records with edits nobody has published · {percent}% of live'
    },
    nothingLive: {
        id: 'content.insights.signal.unshipped.nothingLive',
        defaultMessage: 'Nothing has gone live yet'
    }
});

/**
 * Live records whose live version is behind what an editor saved — work that
 * is finished and waiting only on somebody pressing Publish.
 *
 * The share is of **live** records, as on the chart: "2% of live" is a backlog
 * someone can clear.
 */
export function UnshippedChangesSignal({
    onOpen,
    isOpen
}: InsightsSignalRowProps) {
    const intl = useIntl();
    const { data, isPending, isError } = useContentUnshipped();

    const modified = data?.modified ?? 0;
    const live = data?.live ?? 0;
    const percent = live > 0 ? Math.round((modified / live) * 100) : 0;

    return (
        <SignalRow
            icon={PencilLine}
            tone="warn"
            count={modified}
            title={intl.formatMessage(messages.title)}
            hint={
                live > 0
                    ? intl.formatMessage(messages.hint, { percent })
                    : intl.formatMessage(messages.nothingLive)
            }
            isPending={isPending}
            isError={isError}
            onOpen={onOpen}
            isOpen={isOpen}
        />
    );
}
