import { defineMessages, useIntl } from 'react-intl';
import { Layers } from 'lucide-react';
import { Container, Skeleton } from '@orthacms/design-system';
import { PageTopBar } from '@orthacms/shell-admin';
import { WorkspaceSettingsTopBar } from '../WorkspaceSettingsTopBar';

/** Intl descriptors for the workspaces skeletons, co-located here. */
const messages = defineMessages({
    loading: {
        id: 'workspaces.skeleton.loading',
        defaultMessage: 'Loading workspaces…'
    },
    shellHeading: {
        id: 'workspaces.skeleton.shellHeading',
        defaultMessage: 'Loading workspace'
    },
    loadingForm: {
        id: 'workspaces.skeleton.loadingForm',
        defaultMessage: 'Loading…'
    },
    crumbWorkspaces: {
        id: 'workspaces.skeleton.crumbWorkspaces',
        defaultMessage: 'Workspaces'
    },
    crumbNew: {
        id: 'workspaces.skeleton.crumbNew',
        defaultMessage: 'New workspace'
    },
    loadingContent: {
        id: 'workspaces.skeleton.loadingContent',
        defaultMessage: 'Loading content types…'
    },
    loadingSettings: {
        id: 'workspaces.skeleton.loadingSettings',
        defaultMessage: 'Loading workspace settings…'
    }
});

/**
 * The grid placeholder shown while {@link useWorkspaces} resolves, in the
 * cards' own frame so nothing reflows on swap. It owns the single
 * `role="status"` announcement; the cards themselves are `aria-hidden`.
 */
export function WorkspacesGridSkeleton({ count = 6 }: { count?: number }) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div
                aria-hidden
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
                {Array.from({ length: count }).map((_, index) => (
                    <div
                        key={index}
                        className="flex min-h-[176px] flex-col gap-3 rounded-xl border p-4"
                    >
                        <div className="flex items-start gap-3">
                            <Skeleton className="size-9 shrink-0 rounded-[9px]" />
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48 max-w-full" />
                            </div>
                        </div>
                        <Skeleton className="mt-auto h-3 w-40" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Full-page placeholder for the lazy-route `Suspense` fallback — before
 * {@link WorkspacesPage} mounts there is no header or toolbar yet, so this
 * sketches the whole page (header, toolbar, table) to hold the layout steady
 * while the chunk loads. Reuses {@link WorkspacesGridSkeleton} for the body.
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

            <WorkspacesGridSkeleton />
        </Container>
    );
}

/**
 * Placeholder for the workspace shell's content area — shown both as the
 * lazy-route `Suspense` fallback and while {@link useWorkspaces} resolves inside
 * the shell (the per-workspace nav lives in the app sidebar, injected once the
 * workspace resolves). Owns the single `role="status"` announcement.
 */
export function WorkspaceShellSkeleton() {
    const intl = useIntl();

    return (
        // `aria-busy` marks this as a loading placeholder so the host's route
        // announcer waits past the sr-only heading below and reads the settled
        // page name instead (see `RouteAnnouncer`).
        <div role="status" aria-busy="true" className="min-h-svh p-8">
            {/* The page's `<h1>`, visually hidden. The workspace shell is a lazy
                chunk behind this fallback (and re-shown while `useWorkspaces`
                resolves), so until the real page mounts there is no heading at
                all — failing `page-has-heading-one` and leaving the view
                unnavigable by heading (`ORT-167`). It names the state. */}
            <h1 className="sr-only">
                {intl.formatMessage(messages.shellHeading)}
            </h1>
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div aria-hidden>
                <Skeleton className="h-8 w-48" />
                <Skeleton className="mt-3 h-4 w-80 max-w-full" />
            </div>
        </div>
    );
}

/**
 * Lazy-route `Suspense` fallback for {@link CreateWorkspacePage}, in the
 * page's own frame so nothing moves when the chunk lands.
 *
 * The bar is **real**: its crumbs come from the route, not from data, so the
 * same `PageTopBar` the page renders paints straight away. Below it the
 * header, the horizontal three-step line, the Basics card (name, address,
 * colour swatches, description, footer) and the 300px preview column are
 * sketched at the page's sizes — `Container max-w-[940px]`, `gap-5`, and
 * `lg:grid-cols-[minmax(0,1fr)_300px]`. One `role="status"` names the state;
 * the shapes are `aria-hidden`.
 */
export function CreateWorkspacePageSkeleton() {
    const intl = useIntl();

    return (
        <>
            <PageTopBar
                icon={Layers}
                iconClassName="bg-violet-soft text-violet-soft-foreground"
                crumbs={[
                    {
                        key: 'workspaces',
                        label: intl.formatMessage(messages.crumbWorkspaces),
                        to: '/workspaces'
                    },
                    {
                        key: 'new',
                        label: intl.formatMessage(messages.crumbNew)
                    }
                ]}
            />
            <Container
                className="flex max-w-[940px] flex-col gap-5"
                role="status"
            >
                <span className="sr-only">
                    {intl.formatMessage(messages.loadingForm)}
                </span>
                <div aria-hidden className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-8 w-52" />
                        <Skeleton className="h-4 w-96 max-w-full" />
                    </div>

                    <div className="flex items-center gap-3">
                        {[16, 16, 14].map((width, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3"
                            >
                                {index > 0 ? (
                                    <span className="h-px w-12 bg-border" />
                                ) : null}
                                <Skeleton className="size-5 rounded-full" />
                                <Skeleton
                                    className="h-4"
                                    style={{ width: `${width * 4}px` }}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="rounded-xl border bg-card">
                            <div className="flex flex-col gap-6 p-5">
                                <div className="flex flex-col gap-2.5">
                                    <Skeleton className="h-4 w-36" />
                                    <Skeleton className="h-9 w-full" />
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-9 w-full" />
                                    <Skeleton className="h-4 w-80 max-w-full" />
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    <Skeleton className="h-4 w-14" />
                                    <div className="flex gap-2">
                                        {Array.from({ length: 7 }).map(
                                            (_, index) => (
                                                <Skeleton
                                                    key={index}
                                                    className="size-7 rounded-md"
                                                />
                                            )
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2.5">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-16 w-full" />
                                    <Skeleton className="ml-auto h-3 w-12" />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 border-t px-5 py-3">
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="ml-auto h-8 w-24" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-3 w-16" />
                            <div className="rounded-xl border bg-card">
                                <div className="flex flex-col gap-3 p-3">
                                    <div className="flex items-center gap-2.5">
                                        <Skeleton className="size-9 rounded-lg" />
                                        <div className="flex flex-1 flex-col gap-1.5">
                                            <Skeleton className="h-4 w-28" />
                                            <Skeleton className="h-3 w-16" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-3 w-40" />
                                </div>
                                <div className="flex gap-2 border-t p-2.5">
                                    <Skeleton className="h-7 w-14" />
                                    <Skeleton className="h-7 w-16" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </>
    );
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

/**
 * Full-page placeholder for the workspace-settings lazy-route `Suspense`
 * fallback, mounted in the workspace shell at `/workspaces/:id/settings/*`.
 *
 * The bar is **real**, not a skeleton: it is the page's identity, it hosts the
 * sidebar-reveal trigger when the app sidebar is collapsed, and it derives its
 * crumbs from the URL rather than from data — so the very same
 * {@link WorkspaceSettingsTopBar} the page renders can paint before the chunk
 * arrives, already naming the section being opened. Below it the header, the
 * tab bar and the section card are sketched, so the page slots into a layout
 * that is already the right shape.
 */
export function WorkspaceSettingsPageSkeleton() {
    const intl = useIntl();

    return (
        <>
            <WorkspaceSettingsTopBar />
            <Container className="space-y-6 py-8" role="status">
                <span className="sr-only">
                    {intl.formatMessage(messages.loadingSettings)}
                </span>

                <div aria-hidden className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>

                <div aria-hidden className="flex flex-col gap-6">
                    <div className="flex gap-2 border-b pb-2">
                        {/* Whole literal class strings — Tailwind scans source
                            text and never emits an interpolated width. */}
                        {['w-16', 'w-20', 'w-16', 'w-24'].map(
                            (width, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 px-3 py-1.5"
                                >
                                    <Skeleton className="size-4 shrink-0 rounded" />
                                    <Skeleton className={`h-4 ${width}`} />
                                </div>
                            )
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-6 rounded-xl border p-6">
                        <div className="flex flex-col gap-2">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-72 max-w-full" />
                        </div>
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                        ))}
                        <div className="flex justify-end border-t pt-4">
                            <Skeleton className="h-9 w-28" />
                        </div>
                    </div>
                </div>
            </Container>
        </>
    );
}
