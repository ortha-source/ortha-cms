import { useId, useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';

/** One point on an {@link AreaTrend}. */
export type TrendPoint = {
    /** X-axis label (a week or day). */
    label: string;
    /** The measured value. */
    value: number;
};

/** Props for {@link AreaTrend}. */
export type AreaTrendProps = {
    /** The series, oldest first. */
    points: TrendPoint[];
    /** Describes the whole series for assistive tech. */
    ariaLabel: string;
    /** Column heading for the series in the table view. */
    valueHeading: string;
};

/** Intl descriptors for the trend chart, co-located here. */
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

/* Geometry, in viewBox units. The SVG scales to its container; these numbers
   only set the internal proportions. */
const WIDTH = 560;
const HEIGHT = 176;
const LEFT = 36;
const RIGHT = 12;
const TOP = 12;
const BASELINE = 150;
const GRID_STEPS = 4;

/**
 * Ladder the axis maximum snaps to, per power of ten.
 *
 * Finer than the usual 1/2/5 because that ladder is too coarse here: a series
 * peaking at 52 would snap to 100, leaving the line drawn across the bottom
 * half of a chart that is half empty. Every step divides evenly by
 * {@link GRID_STEPS}, so the ticks stay whole numbers.
 */
const AXIS_STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];

/**
 * Rounds an axis maximum up to a readable number.
 *
 * Without this the top gridline reads "52" and every other one is a fraction of
 * it — axis labels people have to decode rather than read.
 */
function niceMax(value: number): number {
    if (value <= 0) return GRID_STEPS;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const normalized = value / magnitude;
    const snapped = AXIS_STEPS.find((step) => normalized <= step) ?? 10;
    return snapped * magnitude;
}

/**
 * A single-series area chart with a hover crosshair and a table fallback.
 *
 * One series only, and that is intentional: a second line invites a second
 * y-scale, and a dual-axis chart lets the author decide what "crossing over"
 * looks like by choosing the scales. Two measures mean two charts.
 */
export function AreaTrend({ points, ariaLabel, valueHeading }: AreaTrendProps) {
    const intl = useIntl();
    const gradientId = useId();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const geometry = useMemo(() => {
        const max = niceMax(Math.max(...points.map((p) => p.value), 0));
        const span = points.length > 1 ? points.length - 1 : 1;
        const plotWidth = WIDTH - LEFT - RIGHT;
        const plotHeight = BASELINE - TOP;

        const coords = points.map((point, index) => ({
            ...point,
            x: LEFT + (index / span) * plotWidth,
            y: BASELINE - (point.value / max) * plotHeight
        }));

        const line = coords.map((c) => `${c.x},${c.y}`).join(' L');
        const first = coords[0];
        const last = coords[coords.length - 1];

        return {
            max,
            coords,
            linePath: coords.length ? `M${line}` : '',
            areaPath: coords.length
                ? `M${line} L${last.x},${BASELINE} L${first.x},${BASELINE} Z`
                : '',
            last
        };
    }, [points]);

    if (!points.length) return null;

    const active =
        activeIndex === null ? null : (geometry.coords[activeIndex] ?? null);

    /** Snaps the pointer to the nearest point's index. */
    function handleMove(event: React.PointerEvent<SVGSVGElement>): void {
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * WIDTH;
        let nearest = 0;
        let best = Infinity;
        geometry.coords.forEach((coord, index) => {
            const distance = Math.abs(coord.x - x);
            if (distance < best) {
                best = distance;
                nearest = index;
            }
        });
        setActiveIndex(nearest);
    }

    return (
        <div className="flex flex-col gap-1">
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="block h-auto w-full touch-none overflow-visible"
                role="img"
                aria-label={ariaLabel}
                onPointerMove={handleMove}
                onPointerLeave={() => setActiveIndex(null)}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop
                            offset="0%"
                            stopColor="var(--color-chart-1)"
                            stopOpacity="0.22"
                        />
                        <stop
                            offset="100%"
                            stopColor="var(--color-chart-1)"
                            stopOpacity="0"
                        />
                    </linearGradient>
                </defs>

                {Array.from({ length: GRID_STEPS + 1 }, (_, step) => {
                    const y = BASELINE - (step / GRID_STEPS) * (BASELINE - TOP);
                    const tick = Math.round((geometry.max / GRID_STEPS) * step);
                    return (
                        <g key={step}>
                            <line
                                x1={LEFT}
                                y1={y}
                                x2={WIDTH - RIGHT}
                                y2={y}
                                stroke="var(--color-chart-grid)"
                                strokeWidth="1"
                            />
                            <text
                                x={LEFT - 6}
                                y={y + 3}
                                textAnchor="end"
                                className="fill-muted-foreground text-[10px] tabular-nums"
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

                <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
                <path
                    d={geometry.linePath}
                    fill="none"
                    stroke="var(--color-chart-1)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                <line
                    x1={LEFT}
                    y1={BASELINE}
                    x2={WIDTH - RIGHT}
                    y2={BASELINE}
                    stroke="var(--color-chart-axis)"
                    strokeWidth="1"
                />

                {/* The endpoint stays marked when nothing is hovered — the
                    latest value is the one a dashboard reader wants by default. */}
                {!active ? (
                    <>
                        <circle
                            cx={geometry.last.x}
                            cy={geometry.last.y}
                            r="4.5"
                            fill="var(--color-chart-1)"
                            stroke="var(--color-card)"
                            strokeWidth="2"
                        />
                        <text
                            x={geometry.last.x}
                            y={geometry.last.y - 9}
                            textAnchor="end"
                            className="fill-foreground text-[10px] font-semibold tabular-nums"
                        >
                            {geometry.last.value}
                        </text>
                    </>
                ) : (
                    <>
                        <line
                            x1={active.x}
                            y1={TOP}
                            x2={active.x}
                            y2={BASELINE}
                            stroke="var(--color-chart-axis)"
                            strokeWidth="1"
                        />
                        <circle
                            cx={active.x}
                            cy={active.y}
                            r="4.5"
                            fill="var(--color-chart-1)"
                            stroke="var(--color-card)"
                            strokeWidth="2"
                        />
                        <text
                            x={active.x}
                            y={active.y - 9}
                            textAnchor={
                                active.x > WIDTH - 90
                                    ? 'end'
                                    : active.x < LEFT + 60
                                      ? 'start'
                                      : 'middle'
                            }
                            className="fill-foreground text-[10px] font-semibold tabular-nums"
                        >
                            {active.label} · {active.value}
                        </text>
                    </>
                )}

                <text
                    x={LEFT}
                    y={HEIGHT - 6}
                    className="fill-muted-foreground text-[10px]"
                >
                    {points[0].label}
                </text>
                <text
                    x={WIDTH - RIGHT}
                    y={HEIGHT - 6}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px]"
                >
                    {points[points.length - 1].label}
                </text>
            </svg>

            {/* Hover is not available to keyboard or screen-reader users, and
                the crosshair is where the per-point values live — so the same
                numbers have to exist as text. */}
            <details className="text-xs">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                    {intl.formatMessage(messages.tableView)}
                </summary>
                <div className="mt-1.5 overflow-x-auto">
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
        </div>
    );
}
