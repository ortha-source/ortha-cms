import type { ReactNode } from 'react';

/**
 * Column count per number of tiles, as whole literal classes — Tailwind never
 * emits an interpolated one (`[insights:I-21]`). Below `lg` the strip is two
 * tiles wide, as the `xs` size always was.
 */
const COLUMNS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4'
};

/**
 * The Overview band's headline figures, side by side in one bordered strip —
 * the band's `xs` widgets, each a `StatWidget` cell, divided by hairlines.
 *
 * One strip rather than four cards, because the four figures are read as one
 * sentence ("2,460 entries, 2,231 published, 229 drafts, 18 GB") and boxing
 * each separately made them four things to look at.
 */
export function StatStrip({
    count,
    children
}: {
    /** How many tiles the strip holds — sets its columns. */
    count: number;
    /** The tiles. */
    children: ReactNode;
}) {
    return (
        <div
            className={`grid gap-px overflow-hidden rounded-xl border bg-border ${COLUMNS[Math.min(count, 4)] ?? COLUMNS[4]}`}
            data-testid="stat-strip"
        >
            {children}
        </div>
    );
}
