import { defineMessages, useIntl } from 'react-intl';
import { cn } from '@orthacms/design-system';
import { toneBackground } from '../../../utils/chartTone';
import type { TrendPoint } from '../AreaTrend';

/** Intl descriptors for the column chart, co-located here. */
const messages = defineMessages({
    tableView: {
        id: 'insights.chart.tableView',
        defaultMessage: 'Table view'
    },
    period: {
        id: 'insights.chart.period',
        defaultMessage: 'Period'
    }
});

/** Props for {@link ColumnTrend}. */
export type ColumnTrendProps = {
    /** The series, oldest first. */
    points: TrendPoint[];
    /** Describes the whole series for assistive tech. */
    ariaLabel: string;
    /** Formats one column's hover description. */
    describe: (point: TrendPoint) => string;
    /**
     * `compact` (the default) is the small card form: a short plot labelled at
     * its two ends, the last one with its value. `full` is the headline form —
     * a taller plot labelled at its start, middle and end.
     */
    size?: 'compact' | 'full';
    /**
     * Column heading for the values in a collapsed **table view** under the
     * plot. Give it whenever the per-column values matter: they otherwise live
     * only in a hover title, which a keyboard or screen-reader user cannot
     * reach.
     */
    valueHeading?: string;
};

/** Whole literal height classes per size — Tailwind never emits an interpolated one. */
const PLOT_HEIGHT = { compact: 'h-24', full: 'h-32' } as const;

/**
 * A column chart for counted events over time.
 *
 * Columns rather than a line because the values are **discrete tallies** — 61
 * uploads in a week is a count of separate things, and a line drawn between two
 * such counts implies intermediate values that were never measured.
 *
 * The final column takes the deepest ramp step: on a dashboard the newest bar is
 * the one being looked for, and emphasis costs nothing here because the ramp
 * already encodes nothing else.
 */
export function ColumnTrend({
    points,
    ariaLabel,
    describe,
    size = 'compact',
    valueHeading
}: ColumnTrendProps) {
    const intl = useIntl();
    const max = Math.max(...points.map((point) => point.value), 0);
    const denominator = max > 0 ? max : 1;

    if (!points.length) return null;

    const first = points[0];
    const last = points[points.length - 1];
    const middle = points[Math.floor((points.length - 1) / 2)];

    return (
        <div className="flex flex-col gap-1.5">
            <div
                className={cn('flex items-end gap-[3px]', PLOT_HEIGHT[size])}
                role="img"
                aria-label={ariaLabel}
            >
                {points.map((point, index) => (
                    <span
                        key={point.label}
                        title={describe(point)}
                        style={{
                            height: `${Math.max(3, (point.value / denominator) * 100)}%`
                        }}
                        className={cn(
                            'min-h-[3px] flex-1 rounded-t',
                            toneBackground(
                                index === points.length - 1 ? 'q5' : 'q3'
                            )
                        )}
                    />
                ))}
            </div>
            {size === 'full' ? (
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{first.label}</span>
                    {points.length > 2 ? <span>{middle.label}</span> : null}
                    <span>{last.label}</span>
                </div>
            ) : (
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{first.label}</span>
                    <span className="tabular-nums">
                        {last.label} · {last.value}
                    </span>
                </div>
            )}

            {valueHeading ? (
                // Hover titles are unreachable by keyboard and by a screen
                // reader, so the same numbers exist as text.
                <details className="text-xs">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                        {intl.formatMessage(messages.tableView)}
                    </summary>
                    <div className="mt-1.5">
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr>
                                    <th className="border-b py-1 pr-3 text-left font-medium text-muted-foreground">
                                        {intl.formatMessage(messages.period)}
                                    </th>
                                    <th className="border-b py-1 text-right font-medium text-muted-foreground">
                                        {valueHeading}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {points.map((point) => (
                                    <tr key={point.label}>
                                        <td className="border-b py-1 pr-3">
                                            {point.label}
                                        </td>
                                        <td className="border-b py-1 text-right tabular-nums">
                                            {point.value}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            ) : null}
        </div>
    );
}
