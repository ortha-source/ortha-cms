import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { useInsightsRange, type InsightsRange } from '@orthacms/insights-admin';

/** Intl descriptors for the period a change is measured over, co-located here. */
const messages = defineMessages({
    week: { id: 'content.insights.period.7d', defaultMessage: 'this week' },
    month: { id: 'content.insights.period.30d', defaultMessage: 'this month' },
    quarter: {
        id: 'content.insights.period.90d',
        defaultMessage: 'this quarter'
    },
    year: { id: 'content.insights.period.12m', defaultMessage: 'this year' }
});

/** The phrase per window — the page's range picker names the exact span. */
const PERIOD: Record<InsightsRange, MessageDescriptor> = {
    '7d': messages.week,
    '30d': messages.month,
    '90d': messages.quarter,
    '12m': messages.year
};

/**
 * What a change figure is compared against, in words — "+184 **this month**".
 * Every number on the page says compared to what, and a delta's "what" is the
 * selected window.
 */
export function usePeriodPhrase(): string {
    const intl = useIntl();
    const { range } = useInsightsRange();
    return intl.formatMessage(PERIOD[range]);
}
