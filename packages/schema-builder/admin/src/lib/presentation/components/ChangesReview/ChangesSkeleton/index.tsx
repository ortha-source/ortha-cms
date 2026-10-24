import { defineMessages, useIntl } from 'react-intl';
import { Skeleton, SkeletonRegion } from '@orthacms/design-system';

const messages = defineMessages({
    checking: {
        id: 'schemaBuilder.changes.checking',
        defaultMessage: 'Checking your changes…'
    }
});

/** While the plan runs — drizzle-kit can take seconds: a type's card with its rows. */
export function ChangesSkeleton({ rows = 3 }: { rows?: number }) {
    const intl = useIntl();
    return (
        <SkeletonRegion
            label={intl.formatMessage(messages.checking)}
            className="overflow-hidden rounded-xl border bg-card"
        >
            <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="ml-auto h-5 w-12 rounded-md" />
            </div>
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-start gap-3 border-t px-4 py-3 first:border-t-0"
                >
                    <Skeleton className="size-5 rounded" />
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3.5 w-64" />
                    </div>
                </div>
            ))}
        </SkeletonRegion>
    );
}
