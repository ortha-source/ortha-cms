import { Skeleton } from '@orthacms/design-system';

/** Type icon · label over machine name · type in words — the columns of `FieldRow`. */
export function FieldRowSkeleton({ width }: { width: string }) {
    return (
        <div className="flex min-h-[3.25rem] items-center gap-3 border-t px-4 first:border-t-0">
            <Skeleton className="size-7 rounded-md" />
            <div className="flex flex-col gap-1.5">
                <Skeleton className={`h-4 ${width}`} />
                <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="ml-auto h-4 w-20" />
        </div>
    );
}
