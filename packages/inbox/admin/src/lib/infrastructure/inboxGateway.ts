import { apiClient, toApiError } from '@orthacms/utils-admin';
import {
    INBOX_CATEGORIES,
    type InboxCategory,
    type InboxItem,
    type InboxPage,
    type InboxSummary
} from '../domain/types';

/** `GET /api/inbox` line, as it travels. */
export type InboxItemResponse = {
    id: string;
    kind: string;
    category: string;
    workspaceId: string | null;
    payload: Record<string, unknown> | null;
    link: string;
    createdAt: string;
    readAt: string | null;
};

/** Which page to read. */
export type InboxQuery = {
    category?: InboxCategory;
    unread?: boolean;
    before?: string;
};

/** Wire → view: the link becomes an absolute admin path, the tab a known one. */
export function toInboxItem(row: InboxItemResponse): InboxItem {
    const category = INBOX_CATEGORIES.find((known) => known === row.category);
    return {
        id: row.id,
        kind: row.kind,
        // An unknown tab files under "updates" rather than disappearing.
        category: category ?? 'updates',
        workspaceId: row.workspaceId,
        payload: row.payload ?? {},
        to: `/${row.link.replace(/^\/+/, '')}`,
        createdAt: row.createdAt,
        read: row.readAt !== null
    };
}

/** The port the hooks call. One implementation, over `apiClient`. */
export type InboxGateway = {
    page(query: InboxQuery): Promise<InboxPage>;
    summary(): Promise<InboxSummary>;
    markRead(id: string): Promise<void>;
    markAllRead(category?: InboxCategory): Promise<number>;
};

export const httpInboxGateway: InboxGateway = {
    async page(query) {
        try {
            const { data } = await apiClient.get<{
                items: InboxItemResponse[];
                nextCursor: string | null;
            }>('/inbox', {
                params: {
                    ...(query.category ? { category: query.category } : {}),
                    ...(query.unread ? { unread: '1' } : {}),
                    ...(query.before ? { before: query.before } : {})
                }
            });
            return {
                items: data.items.map(toInboxItem),
                nextCursor: data.nextCursor
            };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async summary() {
        try {
            const { data } =
                await apiClient.get<InboxSummary>('/inbox/summary');
            const byCategory = Object.fromEntries(
                INBOX_CATEGORIES.map((category) => [
                    category,
                    Number(data.byCategory?.[category]) || 0
                ])
            ) as Record<InboxCategory, number>;
            return { unread: Number(data.unread) || 0, byCategory };
        } catch (error) {
            throw toApiError(error);
        }
    },

    async markRead(id) {
        try {
            await apiClient.post(`/inbox/${encodeURIComponent(id)}/read`);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async markAllRead(category) {
        try {
            const { data } = await apiClient.post<{ marked: number }>(
                '/inbox/read',
                category ? { category } : {}
            );
            return data.marked;
        } catch (error) {
            throw toApiError(error);
        }
    }
};
