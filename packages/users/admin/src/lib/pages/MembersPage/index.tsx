import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Filter, UserPlus } from 'lucide-react';
import {
    QueryBuilderDrawer,
    countRules,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useDebouncedValue } from '@ortha-cms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader
} from '@ortha-cms/design-system';
import { useMembers, DEFAULT_PAGE_SIZE } from '../../api/useMembers';
import { MembersTableSkeleton } from '../../components/MembersSkeleton';
import { EditMemberDialog } from '../../components/EditMemberDialog';
import { MembersEmpty } from '../../components/MembersEmpty';
import { MembersNoAccess } from '../../components/MembersNoAccess';
import { MembersPagination } from '../../components/MembersPagination';
import { MembersTable } from '../../components/MembersTable';
import { MembersToolbar } from '../../components/MembersToolbar';
import { MEMBERS_FILTER_FIELDS } from '../../utils/membersFilterFields';
import type { MembersListParams } from '../../utils/membersKeys';
import type { Member } from '../../types/member';

/** Intl descriptors for {@link MembersPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'users.page.title',
        defaultMessage: 'Members'
    },
    subtitle: {
        id: 'users.page.subtitle',
        defaultMessage:
            '{count, plural, one {# person} other {# people}} who can sign in to this workspace.'
    },
    invite: {
        id: 'users.page.invite',
        defaultMessage: 'Invite member'
    },
    error: {
        id: 'users.page.error',
        defaultMessage: 'Couldn’t load members. Please try again.'
    },
    retry: {
        id: 'users.page.retry',
        defaultMessage: 'Retry'
    },
    filters: {
        id: 'users.page.filters',
        defaultMessage: 'Filters{count, plural, =0 {} other { (#)}}'
    }
});

/** Debounce window for the search box, so a keystroke burst issues one query. */
const SEARCH_DEBOUNCE_MS = 300;

/** Reads a 1-based positive int from a query param, falling back to a default. */
function readInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/**
 * The Members management page: a searchable, filterable, paginated, and
 * deep-linkable table of everyone who can sign in, with invite / edit / role /
 * status controls gated on the signed-in user's `users:*` permissions. The URL
 * query string is the single source of truth for search, the query-builder
 * filter, and the page, so a filtered view can be shared or bookmarked.
 * Rendered at `/users` inside the authenticated shell.
 *
 * Gated on `users:read`: without it the page shows a no-access state and
 * fetches nothing (the server would refuse the request anyway).
 */
export function MembersPage() {
    const intl = useIntl();
    const navigate = useNavigate();
    const canRead = useHasPermission('users:read');
    const canInvite = useHasPermission('users:create');
    const [searchParams, setSearchParams] = useSearchParams();

    // The URL is the source of truth for search, filter, and paging.
    const searchParam = searchParams.get('search') ?? '';
    const filterParam = searchParams.get('filter') ?? '';
    const page = readInt(searchParams.get('page'), 1);
    const pageSize = readInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

    // The search box is debounced locally, then pushed into the URL.
    const [searchInput, setSearchInput] = useState(searchParam);
    const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

    // Rehydrate the applied filter tree from the URL for the drawer. Keyed on
    // the raw param so a deep-linked or hand-edited filter restores on load.
    const appliedFilter = useMemo(
        () => jsonFilterToTree(new URLSearchParams({ filter: filterParam })),
        [filterParam]
    );
    const ruleCount = countRules(appliedFilter);

    const [editing, setEditing] = useState<Member | null>(null);
    // Focus returns here when the edit dialog closes — the row's kebab, which
    // outlives the dialog (only the menu popover closed). Captured on open.
    const restoreFocusRef = useRef<HTMLElement | null>(null);

    /** Merges a query patch into the URL, dropping empty values; resets the
     *  page unless told otherwise (a narrowed result set has fewer pages). */
    const updateParams = useCallback(
        (patch: Record<string, string | undefined>, resetPage = true) => {
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    for (const [key, value] of Object.entries(patch)) {
                        if (value) next.set(key, value);
                        else next.delete(key);
                    }
                    if (resetPage) next.delete('page');
                    return next;
                },
                { replace: true }
            );
        },
        [setSearchParams]
    );

    // Sync the debounced search into the URL. Settles in one extra pass: once
    // the URL reflects the debounced value the guard is false, so no loop.
    useEffect(() => {
        if (debouncedSearch !== searchParam) {
            updateParams({ search: debouncedSearch || undefined });
        }
    }, [debouncedSearch, searchParam, updateParams]);

    const params: MembersListParams = {
        search: searchParam || undefined,
        filter: filterParam || undefined,
        page,
        pageSize
    };

    const { data, isPending, isError, refetch } = useMembers(params, canRead);

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
            <Container>
                <ContainerHeader title={intl.formatMessage(messages.title)} />
                <MembersNoAccess />
            </Container>
        );
    }

    const members = data?.items ?? [];
    const hasFilters = debouncedSearch.trim().length > 0 || ruleCount > 0;

    const openEdit = (member: Member) => {
        restoreFocusRef.current = document.getElementById(
            `member-actions-${member.id}`
        );
        setEditing(member);
    };

    /** Clear every filter (search + query builder) and reset to the first page. */
    const clearFilters = () => {
        setSearchInput('');
        setSearchParams(new URLSearchParams(), { replace: true });
    };

    const openInvite = () => navigate('/users/invite');

    return (
        <Container>
            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle, {
                    count: total
                })}
                actions={
                    canInvite ? (
                        <Button onClick={openInvite}>
                            <UserPlus />
                            {intl.formatMessage(messages.invite)}
                        </Button>
                    ) : undefined
                }
            />

            <MembersToolbar
                search={searchInput}
                onSearchChange={setSearchInput}
                filterControl={
                    <QueryBuilderDrawer
                        fields={MEMBERS_FILTER_FIELDS}
                        value={appliedFilter}
                        onApply={applyFilter}
                        trigger={
                            <Button variant="outline" className="shadow-none">
                                <Filter aria-hidden className="size-4" />
                                {intl.formatMessage(messages.filters, {
                                    count: ruleCount
                                })}
                            </Button>
                        }
                    />
                }
            />

            {isPending ? (
                <MembersTableSkeleton />
            ) : isError ? (
                <Alert variant="destructive" role="alert" className="mt-4">
                    <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                        <span>{intl.formatMessage(messages.error)}</span>
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
                    <MembersTable members={members} onEdit={openEdit} />
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

            <EditMemberDialog
                member={editing}
                restoreFocusRef={restoreFocusRef}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditing(null);
                    }
                }}
            />
        </Container>
    );
}
