import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Activity } from 'lucide-react';
import { PageActionsPortal, PageTopBar } from '@orthacms/shell-admin';
import {
    OP,
    QueryBuilderPopover,
    QueryBuilderSummary,
    COMBINATOR,
    countRules,
    jsonFilterToTree,
    newId,
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
import {
    useActivityLog,
    DEFAULT_PAGE_SIZE
} from '../../../application/useActivityLog';
import { useWorkspaceNames } from '../../../application/useWorkspaceNames';
import {
    ActivityEmpty,
    type ActivityEmptyReason
} from '../../components/ActivityEmpty';
import { ActivityEventSheet } from '../../components/ActivityEventSheet';
import { ActivityExportButton } from '../../components/ActivityExportButton';
import { ActivityFeed } from '../../components/ActivityFeed';
import { ActivityFilterButton } from '../../components/ActivityFilterButton';
import { ActivityLogTableSkeleton } from '../../components/ActivityLogSkeleton';
import { ActivityNoAccess } from '../../components/ActivityNoAccess';
import {
    ActivityPagination,
    PAGE_SIZE_OPTIONS
} from '../../components/ActivityPagination';
import { ActivityToolbar } from '../../components/ActivityToolbar';
import { DeadLetterNotice } from '../../components/DeadLetterNotice';
import { activityDateTime } from '../../activityDateTime';
import { activityFilterFieldsWith } from '../../activityFilterFields';
import {
    DEFAULT_RANGE,
    parseRange,
    rangeDays,
    rangeStart,
    type ActivityRange
} from '../../activityRange';
import { eventWorkspaceId } from '../../activitySubjectLink';
import type { ActivityListParams } from '../../../infrastructure/activityKeys';
import type { ActivityEvent } from '../../../types/activityEvent';

/** Intl descriptors for {@link ActivityLogPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'activity.page.title',
        defaultMessage: 'Activity'
    },
    subtitleRange: {
        id: 'activity.page.subtitle.range',
        // "across every workspace": the log is deployment-wide — this page
        // sends no workspace context — and the subtitle must not let an admin
        // of a multi-workspace deployment read the figure as scoped. See the
        // plugin's AGENTS.md.
        defaultMessage:
            '{count, plural, one {# event} other {# events}} {days, plural, one {today} other {in the last # days}}, across every workspace'
    },
    subtitleAll: {
        id: 'activity.page.subtitle.all',
        defaultMessage:
            '{count, plural, one {# event} other {# events}} across every workspace'
    },
    subtitleMatch: {
        id: 'activity.page.subtitle.match',
        defaultMessage:
            '{count, plural, =0 {No events match} one {# event matches} other {# events match}}'
    },
    error: {
        id: 'activity.page.error',
        defaultMessage: 'Couldn’t load activity. Please try again.'
    },
    retry: {
        id: 'activity.page.retry',
        defaultMessage: 'Retry'
    },
    results: {
        id: 'activity.page.results',
        defaultMessage: '{count, plural, one {# event} other {# events}} found.'
    },
    resultsPaged: {
        id: 'activity.page.resultsPaged',
        defaultMessage:
            '{count, plural, one {# event} other {# events}} found. Showing {from}–{to}, page {page} of {pageCount}.'
    }
});

/**
 * The largest page size the server accepts (`MAX_PAGE_SIZE` on
 * `ListActivityQueryDto`). A hand-edited `?pageSize=` above it is a **400**, and
 * a 400 here is unrecoverable from the UI: the rows-per-page Select is the only
 * control that could fix it and it lives inside the data branch, which a failed
 * query never renders. So the URL value is clamped before it is ever sent —
 * Retry then has something that can succeed (`activity:I-18`).
 */
const MAX_PAGE_SIZE = Math.max(...PAGE_SIZE_OPTIONS);

/** The search box's URL key — the server's free-text `?q=`. */
const SEARCH_KEY = 'q';

/**
 * The Activity page: the audit log as a day-grouped **feed of sentences**, with
 * one search box (people, records, actions), a time range, filters that read
 * back as removable chips, an event panel with a before/after diff, a CSV export
 * of the current view, and the caveat about actions that were not recorded.
 *
 * The URL query string is the single source of truth for the search (`q`), the
 * range (`range`, default the last 7 days), the filter tree (`filter`) and the
 * page (`activity:I-30`), so any view can be shared or bookmarked. Rendered at
 * `/activity` inside the authenticated shell.
 *
 * Gated on `activity:read` (admin-only): without it the page shows a no-access
 * state and fetches nothing (`activity:I-28`).
 */
export function ActivityLogPage() {
    const intl = useIntl();
    // Names this route in the tab strip, the window list, the history
    // and a screen reader's window announcement (WCAG 2.4.2, `ORT-140`).
    useDocumentTitle(intl.formatMessage(messages.title));
    const canRead = useHasPermission('activity:read');

    const [searchParams] = useSearchParams();
    const range = parseRange(searchParams.get('range'));
    const legacyActorEmail = searchParams.get('actorEmail');

    const {
        searchParam,
        filterParam,
        page,
        pageSize: rawPageSize,
        searchInput,
        searchPending,
        setSearchInput,
        updateParams
    } = useTableUrlState({
        searchKey: SEARCH_KEY,
        defaultPageSize: DEFAULT_PAGE_SIZE
    });

    // A link from before the one search box (`?actorEmail=grace`) still lands
    // on what it meant: the free-text search covers the actor's address, so
    // the value moves over rather than being silently dropped.
    useEffect(() => {
        if (legacyActorEmail === null) return;
        setSearchInput(legacyActorEmail);
        updateParams(
            {
                actorEmail: undefined,
                [SEARCH_KEY]: legacyActorEmail || undefined
            },
            false
        );
    }, [legacyActorEmail, setSearchInput, updateParams]);

    // Rehydrate the applied filter tree from the URL for the popover. Keyed on
    // the raw param so a deep-linked or hand-edited filter restores on load.
    const appliedFilter = useMemo(
        () => jsonFilterToTree(filterParam),
        [filterParam]
    );
    const ruleCount = countRules(appliedFilter);

    // `useTableUrlState` floors a nonsensical `?pageSize=` to the default but
    // has no ceiling, so an over-large one reaches the API and 400s.
    const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);

    // The range's lower bound, anchored on local midnight. Recomputed when the
    // day changes, not on every render — a `from` that moved each render would
    // be a new query key each render.
    const dayKey = new Date().toDateString();
    const from = useMemo(() => {
        const start = rangeStart(range, new Date());
        // Through the plugin's one sanctioned stringifier (`activity:I-25`).
        return start ? activityDateTime(start) : undefined;
        // `dayKey` is the point: the start moves at midnight and not before.
    }, [range, dayKey]);

    const params: ActivityListParams = {
        q: searchParam || undefined,
        filter: filterParam || undefined,
        from,
        page,
        pageSize
    };

    const searchRef = useRef<HTMLInputElement>(null);
    const [selected, setSelected] = useState<ActivityEvent | null>(null);

    /** Commit (or clear) the query-builder filter to the URL. */
    const applyFilter = useCallback(
        (next: FilterGroup | null) => {
            updateParams({ filter: treeToJsonFilter(next) ?? undefined });
        },
        [updateParams]
    );

    const { data, isPending, isFetching, isError, isPlaceholderData, refetch } =
        useActivityLog(params, canRead);
    const workspaceNames = useWorkspaceNames(canRead).data;
    const names = useMemo(
        () => workspaceNames ?? new Map<string, string>(),
        [workspaceNames]
    );
    const filterFields = useMemo(
        () => activityFilterFieldsWith(workspaceNames),
        [workspaceNames]
    );

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // Pull `page` back when a filter change leaves fewer pages than the current
    // one, so we never strand the user on an empty page past the end. Guarded on
    // `data` so it runs only after a real response — before the first fetch lands
    // `total` is 0 and `pageCount` is 1, which would otherwise reset a deep-linked
    // `?page=N>1` back to page 1 (`activity:I-29`).
    useEffect(() => {
        if (data && page > pageCount) {
            updateParams(
                { page: pageCount > 1 ? String(pageCount) : undefined },
                false
            );
        }
    }, [data, page, pageCount, updateParams]);

    const crumbs = [
        { key: 'activity', label: intl.formatMessage(messages.title) }
    ];

    if (!canRead) {
        return (
            <>
                <PageTopBar
                    icon={Activity}
                    iconClassName="bg-info-soft text-info-soft-foreground"
                    crumbs={crumbs}
                />
                <Container>
                    <ContainerHeader
                        title={intl.formatMessage(messages.title)}
                    />
                    <ActivityNoAccess />
                </Container>
            </>
        );
    }

    const events = data?.items ?? [];
    const hasFilters = Boolean(searchParam) || ruleCount > 0;
    const days = rangeDays(range);

    const subtitle = hasFilters
        ? intl.formatMessage(messages.subtitleMatch, { count: total })
        : days === null
          ? intl.formatMessage(messages.subtitleAll, { count: total })
          : intl.formatMessage(messages.subtitleRange, {
                count: total,
                days
            });

    const emptyReason: ActivityEmptyReason = hasFilters
        ? 'filtered'
        : range !== 'all'
          ? 'range'
          : 'none';

    // Clear the search and the filters and reset to the first page, keeping
    // the range and the page size.
    //
    // Clearing makes the query return rows, so `ActivityEmpty` — and with it
    // the button the user just pressed — unmounts. React does not move focus
    // when that happens, so it fell to `<body>`; focus goes to the search box
    // instead (WCAG 2.4.3).
    const clearFilters = () => {
        setSearchInput('');
        updateParams({ [SEARCH_KEY]: undefined, filter: undefined });
        searchRef.current?.focus();
    };

    const setRange = (next: ActivityRange) => {
        updateParams({ range: next === DEFAULT_RANGE ? undefined : next });
    };

    const showAllTime = () => {
        setRange('all');
        searchRef.current?.focus();
    };

    // "More by Ada": the actor's own events, as a filter chip that says so.
    // By address when there is one (the chip then reads it), by id otherwise.
    const moreBy = (event: ActivityEvent) => {
        if (!event.actor) return;
        const byEmail = Boolean(event.actor.email);
        const tree: FilterGroup = {
            id: newId(),
            combinator: COMBINATOR.And,
            children: [
                {
                    id: newId(),
                    fieldId: byEmail ? 'actorEmail' : 'actorId',
                    op: OP.Equals,
                    value: event.actor.email ?? event.actor.id
                }
            ]
        };
        // One URL write for both: two `setSearchParams` updaters in one tick
        // each read the same `prev`, so the second would drop the first.
        setSearchInput('');
        updateParams({
            filter: treeToJsonFilter(tree) ?? undefined,
            [SEARCH_KEY]: undefined
        });
        setSelected(null);
        searchRef.current?.focus();
    };

    const selectedWorkspace = selected ? eventWorkspaceId(selected) : null;

    return (
        <>
            <PageTopBar
                icon={Activity}
                iconClassName="bg-info-soft text-info-soft-foreground"
                crumbs={crumbs}
            />
            <PageActionsPortal>
                <ActivityExportButton
                    params={{
                        q: params.q,
                        filter: params.filter,
                        from: params.from
                    }}
                />
            </PageActionsPortal>
            <Container>
                <ContainerHeader
                    title={intl.formatMessage(messages.title)}
                    subtitle={isPending ? undefined : subtitle}
                />

                {/*
                  Above the toolbar, not below the feed: the caveat is about
                  everything under it, and a reader who scrolls to the rows has
                  already started trusting them.
                */}
                <DeadLetterNotice />

                <ActivityToolbar
                    search={searchInput}
                    onSearchChange={setSearchInput}
                    range={range}
                    onRangeChange={setRange}
                    searchRef={searchRef}
                    busy={searchPending || isFetching}
                    filterControl={
                        // The filter builder in a popover anchored to the
                        // labelled "Filter" button. It owns the open state and
                        // the staged draft; the applied conditions read out as
                        // removable chips below.
                        <QueryBuilderPopover
                            fields={filterFields}
                            value={appliedFilter}
                            onApply={applyFilter}
                            trigger={<ActivityFilterButton count={ruleCount} />}
                        />
                    }
                />

                {appliedFilter && ruleCount > 0 ? (
                    <QueryBuilderSummary
                        className="mb-4"
                        tree={appliedFilter}
                        fields={filterFields}
                        onChange={applyFilter}
                    />
                ) : null}

                {/* Announce what changed to assistive tech after a filter or a
                    page change moves the feed without a navigation (WCAG
                    4.1.3). The range and page ride along, because the count
                    alone is invariant across pages and pressing Next page
                    would otherwise announce nothing at all. */}
                {!isPending && !isError && (
                    <p role="status" aria-live="polite" className="sr-only">
                        {events.length > 0
                            ? intl.formatMessage(messages.resultsPaged, {
                                  count: total,
                                  from: (page - 1) * effectivePageSize + 1,
                                  to: Math.min(page * effectivePageSize, total),
                                  page,
                                  pageCount
                              })
                            : intl.formatMessage(messages.results, {
                                  count: total
                              })}
                    </p>
                )}

                {isPending ? (
                    <ActivityLogTableSkeleton />
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
                ) : events.length === 0 ? (
                    <ActivityEmpty
                        reason={emptyReason}
                        onClear={clearFilters}
                        onShowAll={showAllTime}
                    />
                ) : (
                    <div>
                        <ActivityFeed
                            events={events}
                            workspaceNames={names}
                            selectedId={selected?.id ?? null}
                            onSelect={setSelected}
                            stale={isPlaceholderData}
                        />
                        <ActivityPagination
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
                    </div>
                )}
            </Container>

            <ActivityEventSheet
                event={selected}
                workspaceName={
                    selectedWorkspace ? names.get(selectedWorkspace) : undefined
                }
                onClose={() => setSelected(null)}
                onMoreBy={moreBy}
            />
        </>
    );
}
