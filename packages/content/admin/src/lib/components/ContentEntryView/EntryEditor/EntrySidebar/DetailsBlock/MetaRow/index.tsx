import type { ReactNode } from 'react';

/**
 * One label/value row in the {@link DetailsBlock} list. Defaults to a side-by-side
 * row (label left, value right); pass `stacked` for a long value (e.g. a UUID)
 * that should sit full-width on its own line beneath the label instead of
 * wrapping awkwardly.
 */
export function MetaRow({
    label,
    stacked = false,
    children
}: {
    label: string;
    stacked?: boolean;
    children: ReactNode;
}) {
    if (stacked) {
        return (
            <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">
                    {label}
                </dt>
                <dd className="text-sm">{children}</dd>
            </div>
        );
    }
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}
