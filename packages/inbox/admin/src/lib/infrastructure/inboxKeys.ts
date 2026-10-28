import type { InboxQuery } from './inboxGateway';

/**
 * Query keys. The inbox is the signed-in person's own and spans workspaces, so
 * no key carries a workspace id — and every key sits under `inboxRoot`, which
 * is what a read refreshes.
 */
export const inboxRoot = ['inbox'] as const;

export const inboxSummaryKey = ['inbox', 'summary'] as const;

export const inboxPageKey = (query: Omit<InboxQuery, 'before'>) =>
    [
        'inbox',
        'page',
        query.category ?? 'all',
        query.unread ? 'unread' : 'any'
    ] as const;
