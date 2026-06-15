import { useCallback, useEffect, useMemo } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Filter } from 'lucide-react';
import {
    QueryBuilderDrawer,
    countRules,
    jsonFilterToTree,
    treeToJsonFilter,
    type FilterGroup
} from '@ortha-cms/query-builder-admin';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useTableUrlState } from '@ortha-cms/utils-admin';
import {
    Alert,
    AlertDescription,
    Button,
    Container,
    ContainerHeader
} from '@ortha-cms/design-system';
import { useActivityLog, DEFAULT_PAGE_SIZE } from '../../api/useActivityLog';
import { ActivityEmpty } from '../../components/ActivityEmpty';
import { ActivityLogTableSkeleton } from '../../components/ActivityLogSkeleton';
import { ActivityNoAccess } from '../../components/ActivityNoAccess';
import { ActivityPagination } from '../../components/ActivityPagination';
import { ActivityTable } from '../../components/ActivityTable';
import { ActivityToolbar } from '../../components/ActivityToolbar';
import { ACTIVITY_FILTER_FIELDS } from '../../utils/activityFilterFields';
import type { ActivityListParams } from '../../utils/activityKeys';

/** Intl descriptors for {@link ActivityLogPage}, co-located with the component. */
const messages = defineMessages({
    title: {
        id: 'activity.page.title',
        defaultMessage: 'Activity'
    },
    subtitle: {
        id: 'activity.page.subtitle',
        defaultMessage:
            '{count, plural, one {# event} other {# events}} across the workspace.'
    },
    error: {
        id: 'activity.page.error',
        defaultMessage: 'Couldn’t load activity. Please try again.'
    },
    retry: {
        id: 'activity.page.retry',
        defaultMessage: 'Retry'
    },
    filters: {
        id: 'activity.page.filters',
        defaultMessage: 'Filters{count, plural, =0 {} other { (#)}}'
    },
    results: {
        id: 'activity.page.results',
        defaultMessage: '{count, plural, one {# event} other {# events}} found.'
    }
});

/**
 * The Activity Log page: a filterable, paginated, deep-linkable table of audit
 * events. The URL query string is the single source of truth for every filter
 * and page (via `useTableUrlState`), so a filtered view can be shared or
 * bookmarked. Rendered at `/activity` inside the authenticated shell.
 *
 * Gated on `activity:read` (admin-only): without it the page shows a no-access
 * state and fetches nothing (the server refuses the request anyway).
 */
export function ActivityLogPage() {
    const intl = useIntl();
    const canRead = useHasPermission('activity:read');

    const {
        searchParam: emailParam,
        filterParam,
        page,
        pageSize,
        searchInput: emailInput,
        setSearchInput: setEmailInput,
        updateParams
    } = useTableUrlState({
        searchKey: 'actorEmail',
        defaultPageSize: DEFAULT_PAGE_SIZE
    });

    // Rehydrate the applied filter tree from the URL for the drawer. Keyed on
    // the raw param so a deep-linked or hand-edited filter restores on load.
    const appliedFilter = useMemo(
        () => jsonFilterToTree(filterParam),
        [filterParam]
    );
    const ruleCount = countRules(appliedFilter);

    const params: ActivityListParams = {
        actorEmail: emailParam || undefined,
        filter: filterParam || undefined,
        page,
        pageSize
    };

    /** Commit (or clear) the query-builder filter to the URL. */
    const applyFilter = useCallback(
        (next: FilterGroup | null) => {
            updateParams({ filter: treeToJsonFilter(next) ?? undefined });
        },
        [updateParams]
    );

    const { data, isPending, isError, isPlaceholderData, refetch } =
        useActivityLog(params, canRead);

    const total = data?.total ?? 0;
    const effectivePageSize = data?.pageSize ?? pageSize;
    const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));

    // Pull `page` back when a filter change leaves fewer pages than the current
    // one, so we never strand the user on an empty page past the end. Guarded on
    // `data` so it runs only after a real response — before the first fetch lands
    // `total` is 0 and `pageCount` is 1, which would otherwise reset a deep-linked
    // `?page=N>1` back to page 1.
    useEffect(() => {
        if (data && page > pageCount) {
            updateParams(
                { page: pageCount > 1 ? String(pageCount) : undefined },
                false
            );
        }
    }, [data, page, pageCount, updateParams]);

    if (!canRead) {
        return (
            <Container>
                <ContainerHeader title={intl.formatMessage(messages.title)} />
                <ActivityNoAccess />
            </Container>
        );
    }

    const events = data?.items ?? [];
    const hasFilters = Boolean(emailParam) || ruleCount > 0;

    // Clear the filters (actor-email + query builder) and reset to the first
    // page, while preserving the user's sort/order/page-size choices.
    const clearFilters = () => {
        setEmailInput('');
        updateParams({ actorEmail: undefined, filter: undefined });
    };

    return (
        <Container>
            <ContainerHeader
                title={intl.formatMessage(messages.title)}
                subtitle={intl.formatMessage(messages.subtitle, {
                    count: total
                })}
            />

            <ActivityToolbar
                email={emailInput}
                onEmailChange={setEmailInput}
                filterControl={
                    <QueryBuilderDrawer
                        fields={ACTIVITY_FILTER_FIELDS}
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

            {/* Announce the result count to assistive tech after a filter
                changes the table without a navigation (WCAG 4.1.3). */}
            {!isPending && !isError && (
                <p role="status" aria-live="polite" className="sr-only">
                    {intl.formatMessage(messages.results, { count: total })}
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
                <ActivityEmpty filtered={hasFilters} onClear={clearFilters} />
            ) : (
                <div aria-busy={isPlaceholderData}>
                    <ActivityTable events={events} />
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
    );
}
