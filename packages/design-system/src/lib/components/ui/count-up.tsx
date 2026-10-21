import { useCountUp } from '../../hooks/use-count-up';

/** Props for {@link CountUp}. */
export type CountUpProps = {
    /** The figure to land on. */
    value: number;
    /**
     * Turns a number into text — `Intl.NumberFormat#format`, `intl.formatNumber`
     * or a unit formatter. Applied to every intermediate figure as well as the
     * final one. Defaults to `String`.
     */
    format?: (value: number) => string;
    /** How long the count runs, in milliseconds. Defaults to 600. */
    duration?: number;
};

/**
 * A number that counts up to `value` (see {@link useCountUp}). Unstyled: put it
 * inside an element with `tabular-nums`, or the figure jitters as its digits
 * change width.
 *
 * While it is counting, the moving figure is `aria-hidden` and the final one
 * sits beside it in an `sr-only` span, so a screen reader (or a test querying
 * by text) only ever meets the real value. Once it lands it is plain text
 * again — one node, nothing duplicated.
 */
export function CountUp({ value, format = String, duration }: CountUpProps) {
    const shown = useCountUp(value, { duration });

    if (shown === value) return <>{format(value)}</>;

    return (
        <>
            <span aria-hidden="true">{format(shown)}</span>
            <span className="sr-only">{format(value)}</span>
        </>
    );
}
