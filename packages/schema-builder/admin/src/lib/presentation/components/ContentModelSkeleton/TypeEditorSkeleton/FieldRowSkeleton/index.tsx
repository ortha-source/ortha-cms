import { Skeleton } from '@orthacms/design-system';

/** Type icon · name · facts · type badge — the columns of `FieldRow`. */
export function FieldRowSkeleton({ width }: { width: string }) {
    return (
        <div className="flex h-12 items-center gap-3 border-t px-4">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className={`h-4 ${width}`} />
            <Skeleton className="ml-auto h-5 w-16 rounded-full" />
        </div>
    );
}
