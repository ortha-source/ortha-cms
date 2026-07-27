import type { ReactNode } from 'react';

/**
 * One label/value row inside an {@link EntrySidebarSection}'s `<dl>` — a muted
 * label on the left, the value on the right, as in the rail's other blocks.
 * Pass `stacked` for a long value (e.g. a UUID) that should sit full-width on
 * its own line beneath the label instead of wrapping awkwardly beside it.
 *
 * Renders a `<dt>`/`<dd>` pair, so it must be inside a `<dl>`. Exported
 * alongside `EntrySidebarSection` so a slot-contributed widget lists its
 * properties exactly like the built-in Details block.
 */
export function EntrySidebarRow({
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
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="text-sm">{children}</dd>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-between gap-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right text-sm">{children}</dd>
        </div>
    );
}
