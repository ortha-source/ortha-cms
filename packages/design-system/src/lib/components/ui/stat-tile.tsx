import type { ComponentType, ReactNode } from 'react';
import { Card, CardContent } from './card';
import { CountUp } from './count-up';
import { cn } from '../../utils';

/** Props for {@link StatTile}. */
export type StatTileProps = {
    /** The metric's label (e.g. "Active workspaces"). */
    label: ReactNode;
    /**
     * The metric's value. A **number** counts up to itself (from 0 on mount,
     * from the previous figure on change — see {@link CountUp}); anything else
     * (a placeholder, a pre-formatted string) is drawn as given.
     */
    value: ReactNode;
    /**
     * Formats a numeric `value` — e.g. `intl.formatNumber`. Applied to every
     * figure of the count, so the digits are grouped the whole way up.
     * Defaults to `String`.
     */
    formatValue?: (value: number) => string;
    /** Optional leading icon, shown muted beside the label. */
    icon?: ComponentType<{ className?: string }>;
    /** Extra classes for the card. */
    className?: string;
};

/**
 * A compact dashboard metric card: a small muted label (with an optional
 * icon) over a large value — the order the Insights tiles use, so the eye
 * reads what a number is before the number. Used to build a stat row (e.g. on the home page).
 */
export function StatTile({
    label,
    value,
    formatValue,
    icon: Icon,
    className
}: StatTileProps) {
    return (
        <Card className={cn('rounded-xl shadow-none', className)}>
            <CardContent className="flex flex-col gap-1.5 p-4">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
                    {label}
                </span>
                <span className="text-[26px] font-semibold leading-8 tracking-[-0.01em] tabular-nums">
                    {typeof value === 'number' ? (
                        <CountUp value={value} format={formatValue} />
                    ) : (
                        value
                    )}
                </span>
            </CardContent>
        </Card>
    );
}
