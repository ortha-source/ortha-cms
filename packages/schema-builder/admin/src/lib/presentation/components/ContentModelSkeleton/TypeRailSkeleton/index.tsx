import { Skeleton } from '@orthacms/design-system';

/** Collections, pages — the reference app's proportions. */
const GROUPS = [5, 2];

/** Group heading + rows, at the real rail's row height (h-9) and padding. */
export function TypeRailSkeleton() {
    return (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-2 shadow-xs">
            {GROUPS.map((rows, group) => (
                <div key={group} className="flex flex-col gap-0.5">
                    <Skeleton className="mx-2 mb-1.5 mt-1 h-3 w-20" />
                    {Array.from({ length: rows }).map((_, row) => (
                        <div
                            key={row}
                            className="flex h-9 items-center gap-2 px-2"
                        >
                            <Skeleton className="size-4 rounded" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-5 w-12 rounded-full" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
