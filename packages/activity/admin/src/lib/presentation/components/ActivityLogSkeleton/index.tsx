import { defineMessages, useIntl } from 'react-intl';
import { Container, Skeleton } from '@orthacms/design-system';

/** Intl descriptors for the activity skeletons, co-located here. */
const messages = defineMessages({
    heading: {
        id: 'activity.skeleton.heading',
        defaultMessage: 'Loading activity'
    },
    loading: {
        id: 'activity.skeleton.loading',
        defaultMessage: 'Loading activity…'
    }
});

/**
 * The feed placeholder shown while {@link useActivityLog} resolves: a day
 * heading over rows shaped like the loaded ones (tile, avatar, a sentence, a
 * time), so the swap does not reflow. Drops into the page body in place of the
 * feed (header and toolbar stay live), so it owns the single `role="status"`
 * announcement; the shapes are `aria-hidden`.
 */
export function ActivityLogTableSkeleton({ rows = 8 }: { rows?: number }) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div aria-hidden className="overflow-hidden rounded-xl border">
                <div className="bg-muted/40 px-4 py-2.5">
                    <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: rows }).map((_, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-3 border-t px-4 py-3"
                    >
                        <Skeleton className="size-6 shrink-0 rounded-md" />
                        <Skeleton className="size-6 shrink-0 rounded-full" />
                        <Skeleton
                            className="h-4"
                            style={{ width: `${40 + ((index * 17) % 35)}%` }}
                        />
                        <Skeleton className="ml-auto h-3 w-10" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Full-page placeholder for the lazy-route `Suspense` fallback — before
 * {@link ActivityLogPage} mounts there is no header or toolbar yet, so this
 * sketches the whole page (header, toolbar, feed) to hold the layout steady
 * while the chunk loads. Reuses {@link ActivityLogTableSkeleton} for the body.
 */
export function ActivityLogPageSkeleton() {
    const intl = useIntl();

    return (
        // `aria-busy` marks this as a loading placeholder so the host's route
        // announcer waits past the sr-only heading below and reads the settled
        // page name instead (see `RouteAnnouncer`).
        <Container aria-busy="true">
            {/* The page's `<h1>`, visually hidden. A lazy route's `Suspense`
                fallback is a whole page with no heading until the real one
                mounts, so it fails the `page-has-heading-one` axe rule and is
                unnavigable by heading (`ORT-167`). It names the state, not the
                page, matching the Members and Content library skeletons. */}
            <h1 className="sr-only">{intl.formatMessage(messages.heading)}</h1>
            <div className="mb-6 flex flex-col gap-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-64 max-w-full" />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-full sm:max-w-[320px]" />
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-20" />
            </div>

            <ActivityLogTableSkeleton />
        </Container>
    );
}
