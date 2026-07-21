import { Skeleton } from '@ortha-cms/design-system';

/** Placeholder rows shown while the first token page loads. */
export function ApiTokensSkeleton() {
    return (
        <div className="mt-4 space-y-3" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-md" />
            ))}
        </div>
    );
}
