import { defineMessages, useIntl } from 'react-intl';
import { StatWidget } from '@orthacms/insights-admin';
import { useContentTotals } from '../../../application/useContentInsights';
import { usePeriodPhrase } from '../../insightsPeriod';

/** Intl descriptors for the entries stat tile, co-located here. */
const messages = defineMessages({
    label: {
        id: 'content.insights.entries.label',
        defaultMessage: 'Entries'
    },
    flat: {
        id: 'content.insights.entries.flat',
        defaultMessage: 'none new {period}'
    }
});

/**
 * Total entries in the workspace, with the number created inside the selected
 * range ("+184 this month") and a sparkline of how the total got there.
 */
export function ContentEntriesStat() {
    const intl = useIntl();
    const period = usePeriodPhrase();
    const { data, isPending, isError } = useContentTotals();

    const delta = data?.entriesDelta ?? 0;

    return (
        <StatWidget
            label={intl.formatMessage(messages.label)}
            count={data?.entries ?? 0}
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
            history={data?.entriesHistory}
            isPending={isPending}
            isError={isError}
        />
    );
}
