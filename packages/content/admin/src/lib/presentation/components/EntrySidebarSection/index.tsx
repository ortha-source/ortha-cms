import type { ReactNode } from 'react';

/**
 * One block of the entry editor's right rail.
 *
 * The rail is a **single flat panel**, not a stack of floating cards: a block is
 * a plain section with a small heading, and neighbouring blocks are told apart
 * by a **divider** (drawn by the rail's `divide-y` wrapper, not by the section)
 * — so the rail reads as one surface with sections rather than a column of
 * boxes with their own borders, shadows, and tinted backgrounds.
 *
 * Exported from the package index so a plugin contributing an
 * `ENTRY_SIDEBAR_WIDGET_SLOT` widget renders the *same* chrome as the built-in
 * blocks instead of a look-alike that drifts — the same reason `ChangedBadge`
 * and `EntryStatusBadge` are shared.
 */
export function EntrySidebarSection({
    title,
    action,
    description,
    children
}: {
    /** The block's heading. Omitted for an untitled block (the action bar). */
    title?: string;
    /** A right-aligned adornment beside the heading (e.g. the gate's status). */
    action?: ReactNode;
    /** A one-line explanation under the heading. */
    description?: ReactNode;
    children: ReactNode;
}) {
    return (
        <section className="px-5 py-4">
            {title ? (
                <div className="mb-3 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                        {/* h3: the rail's own header is the h2 under the
                            editor's h1, so a section sits one level below it. */}
                        <h3 className="text-sm font-semibold tracking-[-0.01em]">
                            {title}
                        </h3>
                        {action}
                    </div>
                    {description ? (
                        <p className="text-xs text-muted-foreground">
                            {description}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}
