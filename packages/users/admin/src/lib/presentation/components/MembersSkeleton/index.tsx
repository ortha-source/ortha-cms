import { defineMessages, useIntl } from 'react-intl';
import { Users } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import {
    Container,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@orthacms/design-system';

/** Intl descriptors for the members skeletons, co-located here. */
const messages = defineMessages({
    heading: {
        id: 'users.skeleton.heading',
        defaultMessage: 'Loading members'
    },
    loading: {
        id: 'users.skeleton.loading',
        defaultMessage: 'Loading members…'
    },
    inviteHeading: {
        id: 'users.skeleton.inviteHeading',
        defaultMessage: 'Loading the invite form'
    },
    crumbMembers: {
        id: 'users.invitePage.crumbMembers',
        defaultMessage: 'Members'
    },
    inviteCrumb: {
        id: 'users.inviteSheet.title',
        defaultMessage: 'Invite people'
    }
});

/**
 * The members-table placeholder shown while {@link useMembers} resolves. Built
 * from the real `Table` primitives so column widths and the header match the
 * loaded table exactly (no reflow on swap). Drops into the page body in place
 * of the table (header + toolbar stay live), so it owns the single
 * `role="status"` announcement; the table itself is `aria-hidden`.
 */
export function MembersTableSkeleton({ rows = 5 }: { rows?: number }) {
    const intl = useIntl();

    return (
        <div role="status">
            <span className="sr-only">
                {intl.formatMessage(messages.loading)}
            </span>
            <div aria-hidden>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Skeleton className="h-4 w-16" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-10" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-12" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                            <TableHead>
                                <Skeleton className="h-4 w-12" />
                            </TableHead>
                            <TableHead className="w-28" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rows }).map((_, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="size-7 shrink-0 rounded-full" />
                                        <div className="flex flex-col gap-1.5">
                                            <Skeleton className="h-3.5 w-28" />
                                            <Skeleton className="h-3 w-36" />
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-[18px] w-16 rounded-md" />
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-[3px]">
                                        <Skeleton className="size-5 rounded-[5px]" />
                                        <Skeleton className="size-5 rounded-[5px]" />
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-[18px] w-16 rounded-md" />
                                </TableCell>
                                <TableCell>
                                    <Skeleton className="h-4 w-20" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <Skeleton className="ml-auto size-8 rounded-md" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

/**
 * Full-page placeholder for the lazy-route `Suspense` fallback — before
 * {@link MembersPage} mounts there is no header or toolbar yet, so this sketches
 * the whole page (header, search toolbar, table) to hold the layout steady
 * while the chunk loads. Reuses {@link MembersTableSkeleton} for the body.
 */
export function MembersPageSkeleton() {
    const intl = useIntl();

    return (
        // `aria-busy` marks this as a loading placeholder so the host's route
        // announcer waits past the sr-only "Loading members" heading below and
        // reads the settled page name instead (see `RouteAnnouncer`).
        <Container aria-busy="true">
            {/* The page's `<h1>`, visually hidden. A lazy route's `Suspense`
                fallback is a whole page with no heading at all until the real
                one mounts — and it is the state a slow connection sits in
                longest, so it is the one most likely to be navigated by heading
                (`ORT-167`).

                It names the **state**, not the page, and deliberately: an `<h1>`
                repeating the loaded page's would put two identically-named
                level-one headings on screen across the swap, which is ambiguous
                to a reader and to anything locating by heading. "Loading X" is
                also the more useful thing to hear here. */}
            <h1 className="sr-only">{intl.formatMessage(messages.heading)}</h1>
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-8 w-40" />
                    <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <Skeleton className="h-9 w-36 shrink-0" />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-9 w-full sm:ml-auto sm:w-[260px]" />
            </div>

            <MembersTableSkeleton />
        </Container>
    );
}

/**
 * The invite page's lazy-route fallback, in the page's own frame — the top
 * bar's "Members › Invite people", a header, and the form card's sections — so
 * nothing shifts when the chunk lands. Its `<h1>` names the loading state, as
 * {@link MembersPageSkeleton}'s does.
 */
export function InviteMembersPageSkeleton() {
    const intl = useIntl();

    return (
        <>
            <PageTopBar
                icon={Users}
                iconClassName="bg-success-soft text-success-soft-foreground"
                crumbs={[
                    {
                        key: 'members',
                        label: intl.formatMessage(messages.crumbMembers),
                        to: '/users'
                    },
                    {
                        key: 'invite',
                        label: intl.formatMessage(messages.inviteCrumb)
                    }
                ]}
            />
            <Container aria-busy="true" className="max-w-[720px]">
                <h1 className="sr-only">
                    {intl.formatMessage(messages.inviteHeading)}
                </h1>
                <div aria-hidden className="mb-5 flex flex-col gap-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-80 max-w-full" />
                </div>
                <div
                    aria-hidden
                    className="flex flex-col gap-6 rounded-xl border p-6"
                >
                    <Skeleton className="h-16 w-full rounded-md" />
                    <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-14 w-full rounded-lg" />
                        <Skeleton className="h-14 w-full rounded-lg" />
                        <Skeleton className="h-14 w-full rounded-lg" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Skeleton className="h-10 rounded-lg" />
                        <Skeleton className="h-10 rounded-lg" />
                    </div>
                </div>
            </Container>
        </>
    );
}
