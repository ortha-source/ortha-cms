import { defineMessages, useIntl } from 'react-intl';
import { StatWidget } from '@orthacms/insights-admin';
import { useContentTotals } from '../../../application/useContentInsights';
import { usePeriodPhrase } from '../../insightsPeriod';

/** Intl descriptors for the published stat tile, co-located here. */
const messages = defineMessages({
    label: {
        id: 'content.insights.published.label',
        defaultMessage: 'Published'
    },
    flat: {
        id: 'content.insights.published.flat',
        defaultMessage: 'none published {period}'
    }
});

/**
 * Entries currently live, with how many went live inside the selected range
 * ("+142 this month").
 *
 * Shares its query with the other content stat tiles — same key, so TanStack
 * Query issues one request for all three while each keeps its own loading and
 * error state.
 */
export function ContentPublishedStat() {
    const intl = useIntl();
    const period = usePeriodPhrase();
    const { data, isPending, isError } = useContentTotals();

    const delta = data?.publishedDelta ?? 0;

    return (
        <StatWidget
            label={intl.formatMessage(messages.label)}
            count={data?.published ?? 0}
            formatCount={(value) => intl.formatNumber(value)}
            deltaValue={
                delta > 0 ? `+${intl.formatNumber(delta)}` : undefined
            }
            delta={
                delta > 0
                    ? period
                    : intl.formatMessage(messages.flat, { period })
            }
            deltaTone={delta > 0 ? 'up' : 'flat'}
            history={data?.publishedHistory}
            isPending={isPending}
            isError={isError}
        />
    );
}
