import { defineMessages, useIntl } from 'react-intl';
import { Skeleton, SkeletonRegion } from '@orthacms/design-system';

const messages = defineMessages({
    checking: {
        id: 'schemaBuilder.changes.checking',
        defaultMessage: 'Checking your changes…'
    }
});

/** While the plan runs — drizzle-kit can take seconds: the badge, the sentence and the reason of each row. */
export function ChangesSkeleton({ rows = 3 }: { rows?: number }) {
    const intl = useIntl();
    return (
        <SkeletonRegion
            label={intl.formatMessage(messages.checking)}
            className="flex flex-col"
        >
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-2 border-b py-3 last:border-0"
                >
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-3.5 w-64" />
                </div>
            ))}
        </SkeletonRegion>
    );
}
