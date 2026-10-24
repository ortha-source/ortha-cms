import { useMemo, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Alert,
    AlertDescription,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Skeleton,
    cn
} from '@orthacms/design-system';
import { MemberActivityRow } from '../../components/MemberActivityRow';
import { useHasPermission } from '@orthacms/identity-admin';
import { useActivityLog } from '@orthacms/activity-admin';
import { MembersPagination } from '../../components/MembersPagination';
import { useUserDetailContext } from '../../userDetailContext';
import { memberActivityFilter } from '../../memberActivityFilter';

/** Default page size for the per-user activity timeline (a pagination option). */
const DEFAULT_PAGE_SIZE = 25;

/** Intl descriptors for {@link UserActivityPage}. */
const messages = defineMessages({
    title: { id: 'users.activity.title', defaultMessage: 'Activity' },
    description: {
        id: 'users.activity.description',
        defaultMessage: 'A timeline of changes to this member’s account.'
    },
    empty: {
        id: 'users.activity.empty',
        defaultMessage: 'No recorded activity yet.'
    },
    error: {
        id: 'users.activity.error',
        defaultMessage: 'Couldn’t load activity. Please try again.'
    },
    retry: { id: 'users.activity.retry', defaultMessage: 'Retry' }
});

/**
 * The Activity tab: a timeline of audit events whose subject is this member,
 * reusing the activity plugin's `useActivityLog` with a pinned `subjectId`
 * filter. Gated on `activity:read` (the rail hides it otherwise). Paginated
 * with the shared members pagination control.
 */
export function UserActivityPage() {
    const intl = useIntl();
    const { member } = useUserDetailContext();
    const canRead = useHasPermission('activity:read');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // The member's personal log: events *about* them (`subjectType=user` and
    // `subjectId=:id` — e.g. they were added/removed from a workspace, their
    // role changed) OR events they *performed* (`actorId=:id` — e.g. they
    // created a workspace, signed in). Serialised to the wire filter grammar the
    // activity endpoint already parses.
    const filter = useMemo(() => memberActivityFilter(member.id), [member.id]);

    const { data, isPending, isError, isPlaceholderData, refetch } =
        useActivityLog({ filter, page, pageSize }, canRead);

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
    const events = data?.items ?? [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{intl.formatMessage(messages.title)}</CardTitle>
                <CardDescription>
                    {intl.formatMessage(messages.description)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {isPending ? (
                    <>
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-lg" />
                    </>
                ) : isError ? (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                            <span>{intl.formatMessage(messages.error)}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => refetch()}
                            >
                                {intl.formatMessage(messages.retry)}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : events.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <>
                        {/* A page turn keeps the previous page on screen
                            (`keepPreviousData`) until the next one lands: it
                            dims after a beat — the design-system Table's
                            `stale` contract — instead of looking current. */}
                        <ul
                            aria-busy={isPlaceholderData || undefined}
                            className={cn(
                                'transition-opacity duration-(--ds-duration-base) motion-reduce:transition-none',
                                isPlaceholderData && 'opacity-60 delay-150'
                            )}
                        >
                            {events.map((event) => (
                                <MemberActivityRow
                                    key={event.id}
                                    event={event}
                                />
                            ))}
                        </ul>
                        <MembersPagination
                            page={page}
                            pageCount={pageCount}
                            pageSize={effectivePageSize}
                            total={total}
                            onPageChange={setPage}
                            onPageSizeChange={(next) => {
                                setPageSize(next);
                                setPage(1);
                            }}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    );
}
