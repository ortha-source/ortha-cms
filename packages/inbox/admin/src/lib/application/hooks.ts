import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient
} from '@tanstack/react-query';
import type { ApiError } from '@orthacms/utils-admin';
import type { InboxCategory, InboxPage, InboxSummary } from '../domain/types';
import {
    httpInboxGateway,
    type InboxQuery
} from '../infrastructure/inboxGateway';
import {
    inboxPageKey,
    inboxRoot,
    inboxSummaryKey
} from '../infrastructure/inboxKeys';

/**
 * The unread counts — the sidebar badge, the workspace header's button, the
 * page's tab counts. One cache entry for all three. Polled once a minute,
 * because what fills the inbox happens in other people's sessions.
 */
export function useInboxSummary(enabled = true) {
    return useQuery<InboxSummary, ApiError>({
        queryKey: inboxSummaryKey,
        queryFn: () => httpInboxGateway.summary(),
        enabled,
        staleTime: 30_000,
        refetchInterval: 60_000,
        retry: 1
    });
}

/** One tab's items, newest first, a page at a time. */
export function useInboxPages(query: Omit<InboxQuery, 'before'>) {
    return useInfiniteQuery<InboxPage, ApiError>({
        queryKey: inboxPageKey(query),
        queryFn: ({ pageParam }) =>
            httpInboxGateway.page({
                ...query,
                before: (pageParam as string | undefined) ?? undefined
            }),
        initialPageParam: undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined
    });
}

/**
 * Marks one item read. Refreshes the inbox's own keys and nothing else — a read
 * moves no review and no finding.
 */
export function useMarkRead() {
    const queryClient = useQueryClient();
    return useMutation<void, ApiError, string>({
        mutationFn: (id) => httpInboxGateway.markRead(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxRoot })
    });
}

/** Marks everything read, or one tab. */
export function useMarkAllRead() {
    const queryClient = useQueryClient();
    return useMutation<number, ApiError, InboxCategory | undefined>({
        mutationFn: (category) => httpInboxGateway.markAllRead(category),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxRoot })
    });
}
