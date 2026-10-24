import { Skeleton } from '@orthacms/design-system';

/** Collections, pages — the reference app's proportions. */
const GROUPS = [5, 2];

/** Search, then group heading + rows, at the real rail's row height (h-8) and padding. */
export function TypeRailSkeleton() {
    return (
        <div className="flex flex-col gap-4 p-3">
            <Skeleton className="h-8 w-full rounded-md" />
            {GROUPS.map((rows, group) => (
                <div key={group} className="flex flex-col gap-0.5">
                    <Skeleton className="mx-2 mb-1.5 mt-1 h-3 w-20" />
                    {Array.from({ length: rows }).map((_, row) => (
                        <div
                            key={row}
                            className="flex h-8 items-center gap-2 px-2"
                        >
                            <Skeleton className="size-4 rounded" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-3 w-4" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
