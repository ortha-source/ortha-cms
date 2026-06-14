import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { useDebouncedValue } from '@ortha-cms/utils-admin';
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
    }
});

/** Debounce window for the actor-email search, so a keystroke burst is one query. */
const SEARCH_DEBOUNCE_MS = 300;

/** Reads a 1-based positive int from a query param, falling back to a default. */
function readInt(value: string | null, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

/**
 * The Activity Log page: a filterable, paginated, deep-linkable table of audit
 * events. The URL query string is the single source of truth for every filter
 * and page, so a filtered view can be shared or bookmarked. Rendered at
 * `/activity` inside the authenticated shell.
 *
 * Gated on `activity:read` (admin-only): without it the page shows a no-access
 * state and fetches nothing (the server refuses the request anyway).
 */
export function ActivityLogPage() {
    const intl = useIntl();
    const canRead = useHasPermission('activity:read');
    const [searchParams, setSearchParams] = useSearchParams();

    // The URL is the source of truth for the search filter.
    const emailParam = searchParams.get('actorEmail') ?? '';
    const page = readInt(searchParams.get('page'), 1);
    const pageSize = readInt(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

    // The email box is debounced locally, then pushed into the URL.
    const [emailInput, setEmailInput] = useState(emailParam);
    const debouncedEmail = useDebouncedValue(emailInput, SEARCH_DEBOUNCE_MS);

    /** Merges a filter patch into the URL, dropping empty values; resets the
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

    // Sync the debounced email into the URL. Settles in one extra pass: once
    // the URL reflects the debounced value the guard is false, so no loop.
    useEffect(() => {
        if (debouncedEmail !== emailParam) {
            updateParams({ actorEmail: debouncedEmail || undefined });
        }
    }, [debouncedEmail, emailParam, updateParams]);

    const params: ActivityListParams = {
        actorEmail: emailParam || undefined,
        page,
        pageSize
    };

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
    const hasFilters = Boolean(emailParam);

    const clearFilters = () => {
        setEmailInput('');
        setSearchParams(new URLSearchParams(), { replace: true });
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
            />

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
