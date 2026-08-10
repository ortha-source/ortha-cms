import { defineMessages, useIntl } from 'react-intl';
import {
    SegmentedControl,
    SegmentedControlItem
} from '@ortha-cms/design-system';
import {
    INSIGHTS_RANGES,
    useInsightsRange,
    type InsightsRange
} from '../../../hooks/useInsightsRange';

/** Intl descriptors for the range picker, co-located here. */
const messages = defineMessages({
    label: {
        id: 'insights.range.label',
        defaultMessage: 'Time range'
    },
    '7d': { id: 'insights.range.7d', defaultMessage: '7 days' },
    '30d': { id: 'insights.range.30d', defaultMessage: '30 days' },
    '90d': { id: 'insights.range.90d', defaultMessage: '90 days' },
    '12m': { id: 'insights.range.12m', defaultMessage: '12 months' }
});

/** Compact labels — the control is narrow, the long form is the accessible name. */
const SHORT_LABEL: Record<InsightsRange, string> = {
    '7d': '7d',
    '30d': '30d',
    '90d': '90d',
    '12m': '12m'
};

/**
 * Selects the window every widget on the page reports against.
 *
 * One picker for the whole page rather than per widget: a dashboard where each
 * card covers a different period invites false comparisons between them.
 */
export function InsightsRangePicker() {
    const intl = useIntl();
    const { range, setRange } = useInsightsRange();

    return (
        <SegmentedControl
            value={range}
            onValueChange={(next) => {
                // Radix clears the value when the active item is re-pressed;
                // an empty selection would leave widgets with no window at all.
                if (next) setRange(next as InsightsRange);
            }}
            aria-label={intl.formatMessage(messages.label)}
        >
            {INSIGHTS_RANGES.map((option) => (
                <SegmentedControlItem
                    key={option}
                    value={option}
                    aria-label={intl.formatMessage(messages[option])}
                >
                    {SHORT_LABEL[option]}
                </SegmentedControlItem>
            ))}
        </SegmentedControl>
    );
}
