import { Skeleton } from '@ortha-cms/design-system';

/** How many placeholder rows the loading state renders. */
const ROWS = 8;

/**
 * The records table loading state: a bordered card of shimmer rows that stands
 * in for the table while the schema and the first page of entries resolve, so
 * the layout doesn't jump when data lands.
 */
export function CollectionRecordsSkeleton() {
    return (
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
    );
}
