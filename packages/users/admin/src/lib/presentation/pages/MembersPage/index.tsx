import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Plus, Users } from 'lucide-react';
import { PageTopBar } from '@orthacms/shell-admin';
import {
    QueryBuilderPopover,
    QueryBuilderSummary,
    countRules,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@orthacms/query-builder-admin';
import { useHasPermission } from '@orthacms/identity-admin';
import { useTableUrlState, useDocumentTitle } from '@orthacms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader
} from '@orthacms/design-system';
import { useMembers, DEFAULT_PAGE_SIZE } from '../../../application/useMembers';
import { MembersTableSkeleton } from '../../components/MembersSkeleton';
import { MembersEmpty } from '../../components/MembersEmpty';
import { MembersNoAccess } from '../../components/MembersNoAccess';
import { MembersPagination } from '../../components/MembersPagination';
import { MEMBERS_RESULTS_ANCHOR_ID } from '../../membersResultsAnchor';
import { MembersTable } from '../../components/MembersTable';
import { MembersToolbar } from '../../components/MembersToolbar';
import { MembersQuickFilters } from '../../components/MembersQuickFilters';
import { InviteMembersSheet } from '../../components/InviteMembersSheet';
import { MEMBERS_FILTER_FIELDS } from '../../membersFilterFields';
import {
    QUICK_FILTER_PARAM,
    quickFilterFrom,
    quickFilterParams
} from '../../membersQuickFilter';
import type { MembersListParams } from '../../../infrastructure/membersKeys';

/** Intl descriptors for {@link MembersPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.page.title',
        defaultMessage: 'Members'
    },
    subtitle: {
        id: 'users.page.subtitle',
        defaultMessage:
            '{active, plural, one {# person can} other {# people can}} sign in{invited, plural, =0 {} one { · # invite waiting} other { · # invites waiting}}'
    },
    invite: {
        id: 'users.page.invite',
        defaultMessage: 'Invite people'
    },
    error: {
        id: 'users.page.error',
        defaultMessage: 'Couldn’t load members. Please try again.'
    },
    retry: {
        id: 'users.page.retry',
        defaultMessage: 'Retry'
    },
    results: {
        id: 'users.page.results',
        defaultMessage:
            '{count, plural, one {# member} other {# members}} found.'
    }
});

/**
 * The Members management page: a searchable, filterable, paginated, and
 * deep-linkable table of everyone who can sign in, with invite / edit / role /
 * status controls gated on the signed-in user's `users:*` permissions. The URL
 * query string is the single source of truth for search, the query-builder
 * filter, and the page (via `useTableUrlState`), so a filtered view can be
 * shared or bookmarked. Rendered at `/users` inside the authenticated shell.
 *
 * Gated on `users:read`: without it the page shows a no-access state and
 * fetches nothing (the server would refuse the request anyway).
 */
export function MembersPage({
    inviting = false
}: {
    /**
     * Whether the invite sheet is open — the `/users/invite` route renders this
     * page with it open, so Home's "Invite member" and a bookmark both land on
     * the roster with the sheet over it.
     */
    inviting?: boolean;
}) {
    const intl = useIntl();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    // Names this route in the tab strip, the window list, the history
    // and a screen reader's window announcement. Every private route but
    // Workspaces was still titled a bare "Admin" (WCAG 2.4.2, `ORT-140`).
    useDocumentTitle(intl.formatMessage(messages.title));
    const navigate = useNavigate();
    const canRead = useHasPermission('users:read');
    const canInvite = useHasPermission('users:create');

    const {
        searchParam,
        filterParam,
        page,
        pageSize,
        searchInput,
        searchPending,
        setSearchInput,
        updateParams
    } = useTableUrlState({
        searchKey: 'search',
        defaultPageSize: DEFAULT_PAGE_SIZE
    });

    // Rehydrate the applied filter tree from the URL for the panel. Keyed on
    // the raw param so a deep-linked or hand-edited filter restores on load.
    const appliedFilter = useMemo(
        () => jsonFilterToTree(filterParam),
        [filterParam]
    );
    const ruleCount = countRules(appliedFilter);

    const quickFilter = quickFilterFrom(searchParams.get(QUICK_FILTER_PARAM));

    const params: MembersListParams = {
        search: searchParam || undefined,
        filter: filterParam || undefined,
        ...quickFilterParams(quickFilter),
        page,
        pageSize
    };

    const { data, isPending, isFetching, isError, isPlaceholderData, refetch } =
        useMembers(params, canRead);

    const total = data?.total ?? 0;
    // The server echoes the effective page size; fall back to the requested one
    // until the first response lands.
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // A mutation (revoke/disable) or a narrowing search/filter can leave fewer
    // pages than the current one; pull `page` back so we never strand the user
    // on an empty page past the end. Guarded on `data` so it runs only after a
    // real response — otherwise a deep-linked `?page=N>1` resets to 1 before the
    // first fetch lands (when `total` is 0 and `pageCount` is 1).
    useEffect(() => {
        if (data && page > pageCount) {
            updateParams(
                { page: pageCount > 1 ? String(pageCount) : undefined },
                false
            );
        }
    }, [data, page, pageCount, updateParams]);

    /** Commit (or clear) the query-builder filter to the URL. */
    const applyFilter = useCallback(
        (next: FilterGroup | null) => {
            updateParams({ filter: treeToJsonFilter(next) ?? undefined });
        },
        [updateParams]
    );

    if (!canRead) {
        return (
            <>
                <PageTopBar
                    icon={Users}
                    iconClassName="bg-success-soft text-success-soft-foreground"
                    crumbs={[
                        {
                            key: 'members',
                            label: intl.formatMessage(messages.title)
                        }
                    ]}
                />
                <Container>
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                    />
                    <MembersNoAccess />
                </Container>
            </>
        );
    }

    const members = data?.items ?? [];
    const hasFilters =
        searchInput.trim().length > 0 ||
        ruleCount > 0 ||
        quickFilter !== 'everyone';

    /**
     * Clear the filters (search, quick filter, query builder) and reset to the
     * first page, while preserving the user's page-size choice.
     */
    const clearFilters = () => {
        setSearchInput('');
        updateParams({
            search: undefined,
            filter: undefined,
            [QUICK_FILTER_PARAM]: undefined
        });
    };

    // The sheet is a route (`/users/invite`), so it carries the list's query
    // string both ways: closing it lands on the same filtered page it opened
    // over.
    const openInvite = () =>
        navigate({ pathname: '/users/invite', search: location.search });
    const closeInvite = () =>
        navigate({ pathname: '/users', search: location.search });

    return (
        <>
            <PageTopBar
                icon={Users}
                iconClassName="bg-success-soft text-success-soft-foreground"
                crumbs={[
                    {
                        key: 'members',
                        label: intl.formatMessage(messages.title)
                    }
                ]}
            />
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    // No count until one is known: the read failed or hasn't
                    // landed, and "0 people" is a claim about the directory
                    // rather than a description of what happened.
                    subtitle={
                        isPending || isError || !data
                            ? undefined
                            : intl.formatMessage(messages.subtitle, {
                                  active: data.counts.active,
                                  invited: data.counts.invited
                              })
                    }
                    actions={
                        canInvite ? (
                            <Button onClick={openInvite}>
                                <Plus />
                                {intl.formatMessage(messages.invite)}
                            </Button>
                        ) : undefined
                    }
                />

                <MembersToolbar
                    search={searchInput}
                    onSearchChange={setSearchInput}
                    busy={searchPending || isFetching}
                    quickFilters={
                        <MembersQuickFilters
                            value={quickFilter}
                            counts={data?.counts}
                            onChange={(next) =>
                                updateParams({
                                    [QUICK_FILTER_PARAM]:
                                        next === 'everyone' ? undefined : next
                                })
                            }
                        />
                    }
                    filterControl={
                        // The filter builder in a popover anchored to an
                        // icon-only "Filters" button — the same surface the
                        // activity log and the records list use. It owns its
                        // trigger, open state and staged draft; the applied
                        // conditions read out as removable chips below.
                        <QueryBuilderPopover
                            fields={MEMBERS_FILTER_FIELDS}
                            value={appliedFilter}
                            onApply={applyFilter}
                        />
                    }
                />

                {appliedFilter && ruleCount > 0 ? (
                    <QueryBuilderSummary
                        className="mb-4"
                        tree={appliedFilter}
                        fields={MEMBERS_FILTER_FIELDS}
                        onChange={applyFilter}
                    />
                ) : null}

                {/* Announce the result count to assistive tech after a search or
                filter changes the table without a navigation (WCAG 4.1.3). */}
                {!isPending && !isError && (
                    <p role="status" aria-live="polite" className="sr-only">
                        {intl.formatMessage(messages.results, { count: total })}
                    </p>
                )}

                {/* The focus anchor wraps every result state, not just the
                table: revoking the last row on screen swaps the table for the
                empty state, so an anchor on the table would unmount at exactly
                the moment focus needed somewhere to land. `tabIndex={-1}` keeps
                it focusable programmatically without adding a tab stop. */}
                <div
                    id={MEMBERS_RESULTS_ANCHOR_ID}
                    tabIndex={-1}
                    className="outline-none"
                >
                    {isPending ? (
                        <MembersTableSkeleton />
                    ) : isError ? (
                        <Alert
                            variant="destructive"
                            role="alert"
                            className="mt-4"
                        >
                            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                                <span>
                                    {intl.formatMessage(messages.error)}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="shadow-none"
                                    onClick={() => refetch()}
                                >
                                    {intl.formatMessage(messages.retry)}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : members.length === 0 ? (
                        <MembersEmpty
                            filtered={hasFilters}
                            onClear={clearFilters}
                            onInvite={canInvite ? openInvite : undefined}
                        />
                    ) : (
                        <>
                            <MembersTable
                                members={members}
                                stale={isPlaceholderData}
                            />
                            <MembersPagination
                                page={page}
                                pageCount={pageCount}
                                pageSize={effectivePageSize}
                                total={total}
                                onPageChange={(next) =>
                                    updateParams({ page: String(next) }, false)
                                }
                                onPageSizeChange={(next) =>
                                    updateParams({ pageSize: String(next) })
                                }
                            />
                        </>
                    )}
                </div>
            </Container>
            {inviting && canInvite ? (
                <InviteMembersSheet onClose={closeInvite} />
            ) : null}
        </>
    );
}
