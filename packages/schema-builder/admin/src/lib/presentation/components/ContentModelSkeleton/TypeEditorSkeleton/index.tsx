import { Skeleton } from '@orthacms/design-system';
import { FieldRowSkeleton } from './FieldRowSkeleton';

/** Name widths that read as field names rather than as a striped block. */
const FIELD_WIDTHS = ['w-24', 'w-32', 'w-20', 'w-28', 'w-16', 'w-24'];

/** The type summary card over the field card, at their real paddings. */
export function TypeEditorSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
                <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-40" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                    {['w-16', 'w-24', 'w-20'].map((width) => (
                        <div key={width} className="flex flex-col gap-2">
                            <Skeleton className={`h-3.5 ${width}`} />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="rounded-xl border bg-card shadow-xs">
                <div className="flex items-center gap-2 px-4 py-3">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-3 w-4" />
                </div>
                <div className="bg-muted/40 px-4 py-2.5">
                    <Skeleton className="h-4 w-20" />
                </div>
                {FIELD_WIDTHS.map((width, row) => (
                    <FieldRowSkeleton key={row} width={width} />
                ))}
            </div>
        </div>
    );
}
