import { Skeleton } from '@ortha-cms/design-system';
import type { LocaleSwitchVariant } from '../../../utils/localeTransition';

/** How many placeholder rows the list skeleton renders. */
const ROWS = 8;

/** The records-list skeleton: a toolbar row + a bordered table of shimmer rows. */
function ListSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-40" />
                <div className="ml-auto flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-28" />
                </div>
            </div>
            <div className="rounded-xl border">
                <div className="flex items-center gap-4 border-b px-4 py-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-4 w-24" />
                    ))}
                </div>
                {Array.from({ length: ROWS }).map((_, row) => (
                    <div
                        key={row}
                        className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
                    >
                        {Array.from({ length: 4 }).map((_, cell) => (
                            <Skeleton key={cell} className="h-4 w-24" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** The entry-editor skeleton: a title, tab row, field blocks, and a sidebar card. */
function EditorSkeleton() {
    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-56" />
                <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-8 w-24" />
                    ))}
                </div>
                {Array.from({ length: 4 }).map((_, field) => (
                    <div key={field} className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                ))}
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-[23rem]">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
            </div>
        </div>
    );
}

/**
 * A shimmer stand-in for the page underneath the {@link LocaleSwitchOverlay}
 * while a locale switch plays — so the stale content is hidden and the layout
 * reads before the new content lands. Purely decorative (`aria-hidden`); shape
 * follows the switch's `variant` (a records list vs the entry editor).
 */
export function PageSkeleton({ variant }: { variant: LocaleSwitchVariant }) {
    return (
        <div
            aria-hidden
            data-testid="locale-switch-skeleton"
            className="mx-auto w-full max-w-none p-4 motion-reduce:animate-none sm:p-6"
        >
            {variant === 'editor' ? <EditorSkeleton /> : <ListSkeleton />}
        </div>
    );
}
