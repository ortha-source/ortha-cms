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

/** A single placeholder row mirroring {@link WorkspacesTable}'s row structure. */
function WorkspaceRowSkeleton() {
    return (
        <div className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Skeleton className="size-9 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-1.5 h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-xl" />
        </div>
    );
}

/**
 * The table placeholder shown while {@link useWorkspaces} resolves. Drops into
 * the page body in place of the real table (header + toolbar stay live), so it
 * owns the single `role="status"` announcement; the rows themselves are
 * `aria-hidden`.
 */
export function WorkspacesTableSkeleton({ count = 6 }: { count?: number }) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div aria-hidden className="rounded-xl border">
                {Array.from({ length: count }).map((_, index) => (
                    <WorkspaceRowSkeleton key={index} />
                ))}
            </div>
        </div>
    );
}

/**
 * Full-page placeholder for the lazy-route `Suspense` fallback — before
 * {@link WorkspacesPage} mounts there is no header or toolbar yet, so this
 * sketches the whole page (header, toolbar, table) to hold the layout steady
 * while the chunk loads. Reuses {@link WorkspacesTableSkeleton} for the body.
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
                <Skeleton className="h-9 w-56" />
                <Skeleton className="ml-auto h-4 w-16" />
            </div>

            <WorkspacesTableSkeleton />
        </Container>
    );
}

/**
 * Placeholder for the workspace shell — shown both as the lazy-route `Suspense`
 * fallback and while {@link useWorkspaces} resolves inside the shell. Sketches
 * the left rail (switcher + a few icon buttons) beside an empty content area so
 * the layout holds steady. Owns the single `role="status"` announcement.
 */
export function WorkspaceShellSkeleton() {
    const intl = useIntl();

    return (
        <div role="status" className="flex min-h-svh">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div
                aria-hidden
                className="sticky top-0 flex h-svh w-14 shrink-0 flex-col items-center gap-1.5 self-start border-r border-border bg-[oklch(0.985_0_0)] py-2.5"
            >
                <Skeleton className="size-8 rounded-lg" />
                <div className="my-1 h-px w-7 bg-border" />
                <div className="flex flex-col items-center gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="size-8 rounded-lg" />
                    ))}
                </div>
            </div>
            <div aria-hidden className="min-w-0 flex-1 p-8">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-3 h-4 w-80 max-w-full" />
            </div>
        </div>
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
