import type { ComponentType, ReactNode } from 'react';
import { Card, CardContent } from './card';
import { cn } from '../../utils';

/** Props for {@link StatTile}. */
export type StatTileProps = {
    /** The metric's label (e.g. "Active workspaces"). */
    label: ReactNode;
    /** The metric's value (e.g. a count). */
    value: ReactNode;
    /** Optional leading icon, shown muted beside the label. */
    icon?: ComponentType<{ className?: string }>;
    /** Extra classes for the card. */
    className?: string;
};

/**
 * A compact dashboard metric card: a large value over a muted label, with an
 * optional leading icon. Used to build a stat row (e.g. on the home page).
 */
export function StatTile({
    label,
    value,
    icon: Icon,
    className
}: StatTileProps) {
    return (
        <Card className={cn('shadow-none', className)}>
            <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-2xl font-semibold tracking-[-0.01em] tabular-nums">
                    {value}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    {Icon ? <Icon className="size-4 shrink-0" /> : null}
                    {label}
                </span>
            </CardContent>
        </Card>
    );
}
