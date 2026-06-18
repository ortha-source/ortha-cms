import { defineMessages, useIntl } from 'react-intl';
import {
    Container,
    Skeleton,
    WizardPageSkeleton
} from '@ortha-cms/design-system';

/** Intl descriptors for the workspaces skeletons, co-located here. */
const messages = defineMessages({
    loading: {
        id: 'workspaces.skeleton.loading',
        defaultMessage: 'Loading workspaces…'
    },
    loadingForm: {
        id: 'workspaces.skeleton.loadingForm',
        defaultMessage: 'Loading…'
    },
    loadingContent: {
        id: 'workspaces.skeleton.loadingContent',
        defaultMessage: 'Loading content types…'
    }
});

/** Column template shared with the real grid so there's no reflow on swap. */
const GRID_COLUMNS = 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))';

/** A single placeholder card mirroring {@link WorkspaceCard}'s structure. */
function WorkspaceCardSkeleton() {
    return (
        <div className="flex flex-col rounded-2xl border bg-card p-5">
            <div className="flex items-start gap-3">
                <Skeleton className="size-11 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-2 h-4 w-16 rounded-full" />
                </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-4/5" />
            </div>
            <div className="mt-4 border-t pt-4">
                <div className="flex -space-x-2">
                    <Skeleton className="size-7 rounded-xl" />
                    <Skeleton className="size-7 rounded-xl" />
                    <Skeleton className="size-7 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

/**
 * The card-grid placeholder shown while {@link useWorkspaces} resolves. Drops
 * into the page body in place of the real grid (header + toolbar stay live), so
 * it owns the single `role="status"` announcement; the cards themselves are
 * `aria-hidden`.
 */
export function WorkspaceGridSkeleton({ count = 6 }: { count?: number }) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div
                aria-hidden
                className="grid gap-4"
                style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
                {Array.from({ length: count }).map((_, index) => (
                    <WorkspaceCardSkeleton key={index} />
                ))}
            </div>
        </div>
    );
}

/**
 * Full-page placeholder for the lazy-route `Suspense` fallback — before
 * {@link WorkspacesPage} mounts there is no header or toolbar yet, so this
 * sketches the whole page (header, toolbar, grid) to hold the layout steady
 * while the chunk loads. Reuses {@link WorkspaceGridSkeleton} for the body.
 */
export function WorkspacesPageSkeleton() {
    return (
        <Container>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <Skeleton className="h-9 w-36 shrink-0" />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Skeleton className="h-9 w-full sm:max-w-[360px]" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="ml-auto h-4 w-16" />
            </div>

            <WorkspaceGridSkeleton />
        </Container>
    );
}

/**
 * Lazy-route `Suspense` fallback for {@link CreateWorkspacePage}. Wraps the
 * shared {@link WizardPageSkeleton} so the `sr-only` status stays localized.
 */
export function CreateWorkspacePageSkeleton() {
    const intl = useIntl();

    return <WizardPageSkeleton label={intl.formatMessage(messages.loadingForm)} />;
}

/** A placeholder resource section: a header row over a few selectable rows. */
function ResourceSectionSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded" />
                <Skeleton className="h-4 w-28" />
            </div>
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="flex items-center gap-3 rounded-xl border p-3"
                >
                    <Skeleton className="size-5 shrink-0 rounded" />
                    <Skeleton className="h-4 w-40" />
                </div>
            ))}
        </div>
    );
}

/**
 * Section placeholder shown while {@link useContentTypes} resolves in the
 * create-workspace wizard's "specific content" mode — two resource sections
 * (collections and pages). Replaces the inline spinner so the step keeps its
 * shape. Owns a single `role="status"`; the sections are `aria-hidden`.
 */
export function ContentTypesSkeleton() {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loadingContent)}
            </span>
            <div aria-hidden className="flex flex-col gap-6">
                <ResourceSectionSkeleton />
                <ResourceSectionSkeleton />
            </div>
        </div>
    );
}
