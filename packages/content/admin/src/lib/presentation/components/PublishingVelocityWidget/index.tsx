import { defineMessages, useIntl } from 'react-intl';
import {
    ColumnTrend,
    WidgetCard,
    useInsightsRange,
    type TrendPoint
} from '@orthacms/insights-admin';
import { useContentVelocity } from '../../../application/useContentInsights';
import { denseSeries } from '../../../domain/insightsSeries';

/** Intl descriptors for the velocity widget, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.velocity.title',
        defaultMessage: 'Publishing velocity'
    },
    summary: {
        id: 'content.insights.velocity.summary',
        defaultMessage:
            '{count, number} {count, plural, one {publish} other {publishes}}'
    },
    busiest: {
        id: 'content.insights.velocity.busiest',
        defaultMessage: 'busiest {weekday}'
    },
    valueHeading: {
        id: 'content.insights.velocity.valueHeading',
        defaultMessage: 'Published'
    },
    column: {
        id: 'content.insights.velocity.column',
        defaultMessage: '{period} — {count, number} published'
    },
    ariaLabel: {
        id: 'content.insights.velocity.ariaLabel',
        defaultMessage:
            'Entries published over time, {total, number} in total across {points, number} periods.'
    }
});

/** Date format per bucket width. A month bucket labelled `12 Mar` reads wrong. */
const LABEL_FORMAT = {
    day: { day: 'numeric', month: 'short', timeZone: 'UTC' },
    week: { day: 'numeric', month: 'short', timeZone: 'UTC' },
    month: { month: 'short', year: '2-digit', timeZone: 'UTC' }
} as const;

/** A Monday, so `+ (isoWeekday - 1)` days names any ISO weekday. */
const A_MONDAY = Date.UTC(2024, 0, 1);

/**
 * Entries published per bucket across the selected range, as columns — each
 * one a tally of separate publishes — with the total and the busiest weekday
 * in the header.
 *
 * The server chooses the bucket width from the range, and this widget takes it
 * from the response rather than re-deriving it — two places computing the same
 * rule is two places to get it wrong, and the axis would silently mislabel.
 * Empty buckets are filled in here: the server sends only the ones something
 * happened in, and a column chart drawn from those closes every quiet gap.
 */
export function PublishingVelocityWidget() {
    const intl = useIntl();
    const { days } = useInsightsRange();
    const { data, isPending, isError } = useContentVelocity();

    const granularity = data?.granularity ?? 'week';
    const series = data ? denseSeries(data.points, granularity, days) : [];
    const points: TrendPoint[] = series.map((point) => ({
        label: intl.formatDate(
            `${point.bucket}T00:00:00Z`,
            LABEL_FORMAT[granularity]
        ),
        value: point.value
    }));
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const busiest = data?.busiestWeekday;

    const summary = intl.formatMessage(messages.summary, { count: total });
    const description =
        busiest && total > 0
            ? `${summary} · ${intl.formatMessage(messages.busiest, {
                  weekday: intl.formatDate(
                      A_MONDAY + (busiest - 1) * 24 * 60 * 60 * 1000,
                      { weekday: 'long', timeZone: 'UTC' }
                  )
              })}`
            : summary;

    return (
        <WidgetCard
            title={intl.formatMessage(messages.title)}
            description={data ? description : undefined}
            isPending={isPending}
            isError={isError}
            isEmpty={total === 0}
            skeletonRows={6}
        >
            <ColumnTrend
                size="full"
                points={points}
                valueHeading={intl.formatMessage(messages.valueHeading)}
                describe={(point) =>
                    intl.formatMessage(messages.column, {
                        period: point.label,
                        count: point.value
                    })
                }
                ariaLabel={intl.formatMessage(messages.ariaLabel, {
                    total,
                    points: points.length
                })}
            />
        </WidgetCard>
    );
}
