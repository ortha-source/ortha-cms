/** Props for {@link Sparkline}. */
export type SparklineProps = {
    /** The series, oldest first. At least two values. */
    values: number[];
    /** Draw in a neutral tone — for a metric that isn't really moving. */
    muted?: boolean;
    /**
     * Stretch to the container's width (a stat tile's full width) instead of
     * the fixed 64px. The stroke keeps its weight however wide it is drawn.
     */
    fill?: boolean;
};

/**
 * A tiny unlabelled trend line for a stat tile — shape only, no axis.
 *
 * It answers "which way, and how steadily" at a glance; the precise numbers are
 * the job of the full-size widget the tile sits above. The series is scaled to
 * its own min/max rather than to zero, because at this size the question is the
 * shape of the change, not its magnitude against an origin.
 */
export function Sparkline({
    values,
    muted = false,
    fill = false
}: SparklineProps) {
    if (values.length < 2) return null;

    const max = Math.max(...values);
    const min = Math.min(...values);
    // A perfectly flat series has zero span; dividing by it would put every
    // point at NaN and render nothing at all.
    const span = max - min || 1;
    const step = 62 / (values.length - 1);

    const points = values
        .map((value, index) => {
            const x = 1 + index * step;
            const y = 19 - ((value - min) / span) * 18;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    const lastY = 19 - ((values[values.length - 1] - min) / span) * 18;
    const stroke = muted ? 'var(--color-chart-axis)' : 'var(--color-chart-1)';

    if (fill) {
        // Stretched non-uniformly, so the end marker (which would turn into an
        // ellipse) is left off and the stroke opts out of the scaling.
        return (
            <svg
                viewBox="0 0 64 20"
                preserveAspectRatio="none"
                className="block h-5 w-full overflow-visible"
                aria-hidden="true"
            >
                <polyline
                    points={points}
                    fill="none"
                    stroke={stroke}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>
        );
    }

    return (
        <svg
            viewBox="0 0 64 20"
            className="h-5 w-16 shrink-0 overflow-visible"
            aria-hidden="true"
        >
            <polyline
                points={points}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle
                cx={1 + (values.length - 1) * step}
                cy={lastY}
                r="2.5"
                fill={stroke}
                stroke="var(--color-card)"
                strokeWidth="2"
            />
        </svg>
    );
}
