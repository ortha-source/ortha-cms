import { defineMessages, useIntl } from 'react-intl';
import { Skeleton, SkeletonRegion } from '@orthacms/design-system';

const messages = defineMessages({
    loading: { id: 'inbox.loading', defaultMessage: 'Loading your inbox' }
});

/** The list's shape while it loads — and the lazy route's fallback. */
export function InboxSkeleton() {
    const intl = useIntl();
    return (
        <SkeletonRegion label={intl.formatMessage(messages.loading)}>
            <div className="flex flex-col gap-2 p-6">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
            </div>
        </SkeletonRegion>
    );
}
