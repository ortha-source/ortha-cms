import type { ReactNode } from 'react';
import { cn } from '@ortha-cms/design-system';
import { toneBackground, type ChartTone } from '../../../utils/chartTone';

/** One fill within a {@link BarRowSpec}'s track. */
export type BarSegment = {
    /** Stable key within the row. */
    id: string;
    /** Magnitude, on the same scale as the chart's `max`. */
    value: number;
    /** Which palette role paints it. */
    tone: ChartTone;
    /** Accessible description, surfaced on hover and to assistive tech. */
    label: string;
};

/** One labelled row of a {@link BarRows} chart. */
export type BarRowSpec = {
    /** Stable key. */
    id: string;
    /** Row label, shown at the left. */
    label: string;
    /** The fills, left to right. One segment for a plain bar; two for a split. */
    segments: BarSegment[];
    /** The right-hand readout — the row's value in ink, not inside the fill. */
    readout: ReactNode;
    /** An optional second readout column (e.g. a share of total). */
    secondary?: ReactNode;
};

/** Props for {@link BarRows}. */
export type BarRowsProps = {
    /** The rows, in display order. */
    rows: BarRowSpec[];
    /**
     * Denominator every bar is scaled against. Pass the same value for all rows
     * so lengths are comparable — a per-row max would make every bar full width
     * and encode nothing.
     */
    max: number;
    /** Extra classes for the list container. */
    className?: string;
};

/**
 * A horizontal bar list — the workhorse form for "which of these is biggest".
 *
 * Two deliberate constraints:
 *
 * - **No text inside the fills.** Every value sits in the readout column in an
 *   ink colour. A number printed on a bar has to stay legible against whichever
 *   palette step it lands on, in both themes; moving it out sidesteps the whole
 *   class of contrast bugs rather than managing it.
 * - **Square at the baseline, rounded at the data end.** The rounding marks
 *   where the value *stops*; rounding the origin too would blur where it starts.
 */
export function BarRows({ rows, max, className }: BarRowsProps) {
    // A zero or negative denominator would make every width NaN%, which renders
    // as a full-width bar — the most wrong possible output. Fall back to 1 so
    // empty data draws nothing instead.
    const denominator = max > 0 ? max : 1;

    return (
        <div className={cn('flex flex-col gap-2.5', className)}>
            {rows.map((row) => (
                <div
                    key={row.id}
                    className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-2.5"
                >
                    <span className="truncate text-xs text-muted-foreground">
                        {row.label}
                    </span>

                    <div className="flex h-3.5 min-w-0 gap-0.5">
                        {row.segments.map((segment) => (
                            <span
                                key={segment.id}
                                title={segment.label}
                                style={{
                                    width: `${Math.max(
                                        0,
                                        Math.min(
                                            100,
                                            (segment.value / denominator) * 100
                                        )
                                    )}%`
                                }}
                                className={cn(
                                    'min-w-[3px] rounded-none last:rounded-r',
                                    toneBackground(segment.tone)
                                )}
                            />
                        ))}
                    </div>

                    <span className="flex items-baseline justify-end gap-2 text-xs tabular-nums">
                        <span className="text-foreground">{row.readout}</span>
                        {row.secondary ? (
                            <span className="w-9 text-right text-muted-foreground">
                                {row.secondary}
                            </span>
                        ) : null}
                    </span>
                </div>
            ))}
        </div>
    );
}
