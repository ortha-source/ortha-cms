import { Skeleton } from '@orthacms/design-system';
import { FieldRowSkeleton } from './FieldRowSkeleton';

/** Label widths that read as field labels rather than as a striped block. */
const FIELD_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24'];

/** The type's meta line and its field list, at their real paddings. */
export function TypeEditorSkeleton() {
    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-14" />
                <div className="rounded-xl border bg-card">
                    {FIELD_WIDTHS.map((width, row) => (
                        <FieldRowSkeleton key={row} width={width} />
                    ))}
                </div>
            </div>
        </div>
    );
}
