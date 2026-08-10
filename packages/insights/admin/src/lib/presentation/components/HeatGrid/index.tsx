import { Fragment } from 'react';
import { cn } from '@ortha-cms/design-system';
import {
    toneBackground,
    toneForIntensity,
    toneInk
} from '../../../utils/chartTone';

/** One cell of a {@link HeatGrid}. */
export type HeatCell = {
    /** Stable key within the row. */
    id: string;
    /** Magnitude, normalised to 0–1 by the caller. */
    intensity: number;
    /** Accessible description, surfaced on hover and to assistive tech. */
    title: string;
    /** Optional text printed in the cell (only legible on a tall enough cell). */
    text?: string;
};

/** One labelled row of a {@link HeatGrid}. */
export type HeatRow = {
    /** Stable key. */
    id: string;
    /** Row label, shown at the left. */
    label: string;
    /** Cells, in the order of {@link HeatGridProps.columns}. */
    cells: HeatCell[];
};

/** Props for {@link HeatGrid}. */
export type HeatGridProps = {
    /** Column headings, left to right. */
    columns: string[];
    /** The rows, top to bottom. */
    rows: HeatRow[];
    /** Describes the whole grid for assistive tech. */
    ariaLabel: string;
    /** Width of the row-label column. Defaults to `6.5rem`. */
    labelWidth?: string;
    /** Height of a cell. Defaults to `1.375rem` (punchcard density). */
    cellHeight?: string;
};

/**
 * A two-dimensional heat grid — the form for "when" and "which combination"
 * questions that a bar list flattens away.
 *
 * Intensity is normalised **by the caller**, not here, because only the caller
 * knows whether the denominator should be the grid's own maximum (a punchcard,
 * where relative business is the story) or a fixed 100% (coverage, where the
 * story is distance from complete). Normalising internally would silently make
 * every grid a relative one.
 */
export function HeatGrid({
    columns,
    rows,
    ariaLabel,
    labelWidth = '6.5rem',
    cellHeight = '1.375rem'
}: HeatGridProps) {
    const template = `${labelWidth} repeat(${columns.length}, minmax(0, 1fr))`;

    return (
        <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: template }}
            role="img"
            aria-label={ariaLabel}
        >
            <span />
            {columns.map((column) => (
                <span
                    key={column}
                    className="text-center text-[10px] text-muted-foreground"
                >
                    {column}
                </span>
            ))}

            {rows.map((row) => (
                <Fragment key={row.id}>
                    <span className="truncate pr-1.5 text-right text-[11px] text-muted-foreground">
                        {row.label}
                    </span>
                    {row.cells.map((cell) => {
                        const tone = toneForIntensity(cell.intensity);
                        return (
                            <span
                                key={cell.id}
                                title={cell.title}
                                style={{ height: cellHeight }}
                                className={cn(
                                    'grid min-w-0 place-items-center rounded-[3px] text-[11px] font-semibold tabular-nums',
                                    toneBackground(tone),
                                    toneInk(tone)
                                )}
                            >
                                {cell.text}
                            </span>
                        );
                    })}
                </Fragment>
            ))}
        </div>
    );
}
