import { defineMessages, useIntl } from 'react-intl';
import {
    HeatGrid,
    RampLegend,
    WidgetCard,
    type HeatRow
} from '@orthacms/insights-admin';
import {
    useContentPunchcard,
    viewerTimeZone
} from '../../../application/useContentInsights';

/** Intl descriptors for the punchcard widget, co-located here. */
const messages = defineMessages({
    title: {
        id: 'content.insights.punchcard.title',
        defaultMessage: 'When the work happens'
    },
    description: {
        id: 'content.insights.punchcard.description',
        defaultMessage: 'saves per hour, your time zone'
    },
    descriptionIn: {
        id: 'content.insights.punchcard.descriptionIn',
        defaultMessage: 'saves per hour, {zone}'
    },
    quiet: { id: 'content.insights.punchcard.quiet', defaultMessage: 'quiet' },
    busy: { id: 'content.insights.punchcard.busy', defaultMessage: 'busy' },
    cell: {
        id: 'content.insights.punchcard.cell',
        defaultMessage: '{day} {hour}:00 — {count, number} saves'
    },
    ariaLabel: {
        id: 'content.insights.punchcard.ariaLabel',
        defaultMessage:
            'Editing activity by weekday and hour. {total, number} saves in the period, busiest slot {max, number}.'
    },
    mon: { id: 'content.insights.punchcard.mon', defaultMessage: 'Mon' },
    tue: { id: 'content.insights.punchcard.tue', defaultMessage: 'Tue' },
    wed: { id: 'content.insights.punchcard.wed', defaultMessage: 'Wed' },
    thu: { id: 'content.insights.punchcard.thu', defaultMessage: 'Thu' },
    fri: { id: 'content.insights.punchcard.fri', defaultMessage: 'Fri' },
    sat: { id: 'content.insights.punchcard.sat', defaultMessage: 'Sat' },
    sun: { id: 'content.insights.punchcard.sun', defaultMessage: 'Sun' }
});

/** ISO weekday order — 1 = Monday, matching Postgres `isodow`. */
const WEEKDAYS = [
    messages.mon,
    messages.tue,
    messages.wed,
    messages.thu,
    messages.fri,
    messages.sat,
    messages.sun
] as const;

/**
 * Every hour of the day. The grid is grouped in the viewer's own zone, so a
 * "working hours" window cut from UTC no longer meant anybody's working day —
 * and a team spread over time zones works at hours a fixed window would hide.
 */
const HOURS = Array.from({ length: 24 }, (_, index) => index);

/** A column heading — `09` reads as an hour where `9` reads as a count. */
const hourLabel = (hour: number) => String(hour).padStart(2, '0');

/**
 * Editing activity by weekday and hour, from the revision store — every save,
 * not just the moments something went live.
 */
export function ContentPunchcardWidget() {
    const intl = useIntl();
    const { data, isPending, isError } = useContentPunchcard();

    // The server sends only non-empty slots (most of a 7 x 24 grid is zero), so
    // the dense grid is rebuilt here from a sparse list.
    const counts = new Map(
        (data?.cells ?? []).map((cell) => [
            `${cell.weekday}:${cell.hour}`,
            cell.count
        ])
    );
    const max = data?.max ?? 0;
    // The caption says "your time zone" only when the grid really is in it;
    // a zone the server could not use comes back as UTC, and says so.
    const description =
        !data || data.timeZone === viewerTimeZone()
            ? intl.formatMessage(messages.description)
            : intl.formatMessage(messages.descriptionIn, {
                  zone: data.timeZone
              });

    const rows: HeatRow[] = WEEKDAYS.map((descriptor, index) => {
        const weekday = index + 1;
        const day = intl.formatMessage(descriptor);
        return {
            id: `d${weekday}`,
            label: day,
            cells: HOURS.map((hour) => {
                const count = counts.get(`${weekday}:${hour}`) ?? 0;
                return {
                    id: `h${hour}`,
                    // Normalised against the busiest slot: a punchcard's story
                    // is relative business, not absolute volume.
                    intensity: max > 0 ? count / max : 0,
                    title: intl.formatMessage(messages.cell, {
                        day,
                        hour: hourLabel(hour),
                        count
                    })
                };
            })
        };
    });

    return (
        <WidgetCard
            title={intl.formatMessage(messages.title)}
            description={description}
            isPending={isPending}
            isError={isError}
            isEmpty={(data?.total ?? 0) === 0}
            skeletonRows={7}
        >
            <div className="flex flex-col gap-3">
                <HeatGrid
                    columns={HOURS.map(hourLabel)}
                    rows={rows}
                    labelWidth="2.5rem"
                    ariaLabel={intl.formatMessage(messages.ariaLabel, {
                        total: data?.total ?? 0,
                        max
                    })}
                />
                <RampLegend
                    lowLabel={intl.formatMessage(messages.quiet)}
                    highLabel={intl.formatMessage(messages.busy)}
                />
            </div>
        </WidgetCard>
    );
}
