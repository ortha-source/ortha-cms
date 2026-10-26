import type { ReactNode } from 'react';
import { cn } from '@orthacms/design-system';
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
    /** An optional second readout, beside the first (e.g. a share of total). */
    secondary?: ReactNode;
    /**
     * An optional line under the track, small and muted — the row's breakdown
     * in words ("412 published · 51 modified · 37 draft").
     */
    detail?: ReactNode;
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
 * Each row reads top to bottom: the label and its readout on one line, a
 * full-width track under them, and an optional `detail` line. The track's
 * filled length compares the row with `max`; inside the fill the segments sit
 * flush, split by a hairline, in one rounded shape — the bar reads as one
 * quantity divided, not as separate pills.
 *
 * - **No text inside the fills.** Every value sits in the readout in an ink
 *   colour. A number printed on a bar has to stay legible against whichever
 *   palette step it lands on, in both themes; moving it out sidesteps the whole
 *   class of contrast bugs rather than managing it.
 *
 * A **zero segment is dropped, not drawn**. Segments carry a 3px floor so a
 * small-but-real value stays visible, and that floor turned an absent category
 * into a sliver of colour — a locale with nothing missing rendered a tick of the
 * "missing" hue, which is the chart stating the opposite of its data. Filtering
 * here rather than at each call site means no contributed widget has to know.
 *
 * **Each track is a `role="img"` named by its own segments.** A native `title`
 * is not keyboard-reachable and not dismissible (1.4.13), and a row's readout
 * column states only the first series — so on a split bar the second value
 * reached the user through hue alone (1.4.1) inside a graphic with no
 * accessible name (1.1.1). Every segment already carries a full sentence in
 * `label`; joining them is the alternative. Doing it here fixes every widget
 * that renders this form, which is the one on the Insights page that was
 * missing what its sibling charts already had.
 */
export function BarRows({ rows, max, className }: BarRowsProps) {
    // A zero or negative denominator would make every width NaN%, which renders
    // as a full-width bar — the most wrong possible output. Fall back to 1 so
    // empty data draws nothing instead.
    const denominator = max > 0 ? max : 1;

    return (
        <ul className={cn('flex flex-col gap-4', className)}>
            {rows.map((row) => {
                const drawn = row.segments.filter(
                    (segment) => segment.value > 0
                );
                const sum = drawn.reduce(
                    (total, segment) => total + segment.value,
                    0
                );
                const fill = Math.max(
                    0,
                    Math.min(100, (sum / denominator) * 100)
                );
                return (
                    <li key={row.id} className="flex flex-col gap-1.5">
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="truncate font-medium">
                                {row.label}
                            </span>
                            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                                <span className="text-foreground">
                                    {row.readout}
                                </span>
                                {row.secondary ? (
                                    <span className="text-xs text-muted-foreground">
                                        {row.secondary}
                                    </span>
                                ) : null}
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                                role="img"
                                aria-label={row.segments
                                    .map((segment) => segment.label)
                                    .join('. ')}
                                style={{ width: `${fill}%` }}
                                className={cn(
                                    'flex h-full divide-x divide-background overflow-hidden rounded-full',
                                    // A small-but-real value keeps a visible
                                    // sliver rather than vanishing.
                                    sum > 0 && 'min-w-[3px]'
                                )}
                            >
                                {drawn.map((segment) => (
                                    <span
                                        key={segment.id}
                                        title={segment.label}
                                        style={{ flexGrow: segment.value }}
                                        className={cn(
                                            'h-full min-w-[3px] basis-0',
                                            toneBackground(segment.tone)
                                        )}
                                    />
                                ))}
                            </div>
                        </div>
                        {row.detail ? (
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {row.detail}
                            </span>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}
