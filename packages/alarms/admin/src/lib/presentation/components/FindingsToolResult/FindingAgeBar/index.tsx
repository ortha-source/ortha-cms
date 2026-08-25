import { ageBarWidth } from '../toolOutput';

/** Props for {@link FindingAgeBar}. */
export type FindingAgeBarProps = {
    /** Whole days this finding has been open. */
    days: number;
    /** The oldest finding in the same result — the bar's 100%. */
    oldestDays: number;
    /** The already-formatted sentence, e.g. "open for 94 days". */
    label: string;
};

/**
 * How long one finding has been open, as a bar and a number.
 *
 * **The number is the data; the bar is the comparison.** A reader who cannot
 * see the bar — a screen reader, a forced-colors mode, a printout — loses
 * nothing but the ranking at a glance, because the days are right there as
 * text. That is the ordering the whole strip depends on: colour and length are
 * both redundant with something written down.
 *
 * `aria-hidden` on the track: the label beside it already says "open for 94
 * days", and a `<progress>` or a `meter` role here would announce a second,
 * near-identical fact and imply a completion semantic this has nothing to do
 * with. A finding is not 60% done.
 */
export function FindingAgeBar({ days, oldestDays, label }: FindingAgeBarProps) {
    return (
        <span className="flex w-20 shrink-0 flex-col items-end gap-1">
            <span className="text-muted-foreground text-[11px] tabular-nums">
                {label}
            </span>
            <span
                aria-hidden="true"
                className="bg-muted h-1 w-full overflow-hidden rounded-full"
            >
                <span
                    className="bg-muted-foreground/50 block h-full rounded-full"
                    style={{ width: `${ageBarWidth(days, oldestDays)}%` }}
                />
            </span>
        </span>
    );
}
