import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import { CountUp, Skeleton, cn } from '@orthacms/design-system';
import { Sparkline } from '../Sparkline';

/** Intl descriptors for the stat tile, co-located here. */
const messages = defineMessages({
    unavailable: {
        id: 'insights.stat.unavailable',
        defaultMessage: 'Unavailable —'
    }
});

/** Props for {@link StatWidget}. */
export type StatWidgetProps = {
    /** What is being counted. */
    label: ReactNode;
    /**
     * The headline figure, pre-formatted. Ignored when `count` is given — pass
     * one or the other.
     */
    value?: ReactNode;
    /**
     * The headline figure as a number, which counts up to itself when the
     * figure arrives (and from the old figure when it changes). The final
     * value is what assistive technology reads throughout; reduced motion
     * shows it at once. Prefer this over `value` whenever the figure is a
     * plain count.
     */
    count?: number;
    /** Formats `count` — e.g. `intl.formatNumber`. Defaults to `String`. */
    formatCount?: (value: number) => string;
    /** Unit shown smaller beside the value (e.g. `GB`). */
    unit?: string;
    /**
     * What the figure is compared against, pre-formatted — "this month",
     * "9% of all entries", "3,412 assets". Every number says compared to what.
     */
    delta?: ReactNode;
    /**
     * The change itself, set before `delta` and coloured by `deltaTone` —
     * "+184" in "+184 this month". Only the number takes the colour; the
     * period it is measured over stays in the muted ink.
     */
    deltaValue?: ReactNode;
    /** Whether the change is meaningful movement — drives `deltaValue`'s colour. */
    deltaTone?: 'up' | 'flat';
    /** Recent history for the sparkline, oldest first. At least two points. */
    history?: number[];
    /** True while the query is in flight. */
    isPending?: boolean;
    /** True when the query failed. */
    isError?: boolean;
};

/**
 * A headline figure with what it is compared against and a sparkline — one
 * cell of the Overview band's stat strip.
 *
 * Its own card rather than the design-system `StatTile`, which takes only a
 * label, a value and an icon. A bare number on a dashboard is close to useless:
 * "1,284 entries" answers nothing without "up from what?", which is what the
 * delta and the sparkline are for.
 */
export function StatWidget({
    label,
    value,
    count,
    formatCount,
    unit,
    delta,
    deltaValue,
    deltaTone = 'up',
    history,
    isPending = false,
    isError = false
}: StatWidgetProps) {
    return (
        // A tile, not a card: the Overview band sets its stat tiles side by
        // side in one bordered strip (`StatStrip`), so each is a cell of that
        // strip rather than a box of its own.
        <div className="flex h-full flex-col gap-1 bg-card p-4">
            <span className="text-xs text-muted-foreground">{label}</span>
            {isPending ? (
                <>
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="mt-1 h-4 w-24" />
                </>
            ) : isError ? (
                <>
                    {/* An unreachable count must not render as a real figure —
                        an em dash reads as "unknown", a 0 reads as "none", and
                        those are opposite facts. */}
                    <span
                        className="text-[22px] font-semibold leading-7 tracking-[-0.02em]"
                        aria-hidden="true"
                    >
                        —
                    </span>
                    {/* The em dash is `aria-hidden` (a screen reader reads "—"
                        as nothing or as "dash"), so without this the tile
                        announced its label and no value at all —
                        indistinguishable from a card that simply has none. */}
                    <span className="sr-only">
                        <FormattedMessage {...messages.unavailable} />
                    </span>
                </>
            ) : (
                <>
                    <span className="text-[22px] font-semibold leading-7 tracking-[-0.02em] tabular-nums">
                        {count !== undefined ? (
                            <CountUp value={count} format={formatCount} />
                        ) : (
                            value
                        )}
                        {unit ? (
                            <span className="ml-1 text-[0.7em] font-semibold">
                                {unit}
                            </span>
                        ) : null}
                    </span>
                    {delta || deltaValue ? (
                        <span className="text-xs text-muted-foreground">
                            {deltaValue ? (
                                <span
                                    className={cn(
                                        'font-medium tabular-nums',
                                        deltaTone === 'up'
                                            ? 'text-success'
                                            : 'text-foreground'
                                    )}
                                >
                                    {deltaValue}
                                </span>
                            ) : null}
                            {deltaValue && delta ? ' ' : null}
                            {delta}
                        </span>
                    ) : null}
                    {history && history.length > 1 ? (
                        <span className="mt-2 block">
                            <Sparkline
                                values={history}
                                muted={deltaTone === 'flat'}
                                fill
                            />
                        </span>
                    ) : null}
                </>
            )}
        </div>
    );
}
