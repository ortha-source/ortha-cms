import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@orthacms/design-system';

/**
 * A tab over the records table that is a **place**, not a slice: Trash, and
 * All records seen from the trash. A real link (another route), drawn like the
 * saved-view tabs beside it so the row reads as one set.
 */
export function RecordsTabLink({
    to,
    active,
    children
}: {
    /** The route it opens. */
    to: string;
    /** The route on screen. */
    active: boolean;
    /** Icon + label. */
    children: ReactNode;
}) {
    return (
        <Link
            to={to}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'relative inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] text-muted-foreground outline-none transition-colors [&_svg]:size-3.5',
                'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                'after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full',
                active && 'font-medium text-foreground after:bg-foreground'
            )}
        >
            {children}
        </Link>
    );
}
