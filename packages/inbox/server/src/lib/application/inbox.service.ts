import {
    BadRequestException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import { INBOX_CATEGORIES, type InboxCategory } from '@orthacms/inbox-domain';
import {
    InboxItemRepository,
    type InboxCursor
} from '../infrastructure/inbox-item.repository';
import type {
    InboxItemView,
    InboxPageView,
    InboxSummaryView
} from '../types/inbox-views';

/** The page when the caller states none. */
const DEFAULT_PAGE_SIZE = 30;

/** `createdAt|id` — opaque to the client, stable across inserts. */
function encodeCursor(cursor: InboxCursor): string {
    return `${cursor.createdAt.toISOString()}|${cursor.id}`;
}

function decodeCursor(value: string): InboxCursor {
    const [at, id] = value.split('|');
    const createdAt = new Date(at ?? '');
    if (!id || Number.isNaN(createdAt.getTime())) {
        throw new BadRequestException(
            '`before` is not a cursor this route issued.'
        );
    }
    return { createdAt, id };
}

/**
 * One person's inbox: the pages, the unread counts, the read state.
 *
 * Everything is the **caller's own**: there is no route that names a user, so
 * nobody can read or mark anybody else's items, and no permission to gate —
 * the same footing as `/preferences`.
 */
@Injectable()
export class InboxService {
    constructor(private readonly items: InboxItemRepository) {}

    async page(
        userId: string,
        query: {
            category?: InboxCategory;
            unread?: boolean;
            before?: string;
            limit?: number;
        }
    ): Promise<InboxPageView> {
        const limit = query.limit ?? DEFAULT_PAGE_SIZE;
        // One past the page, to know whether there is a next one.
        const rows = await this.items.page(userId, {
            category: query.category,
            unreadOnly: query.unread,
            before: query.before ? decodeCursor(query.before) : undefined,
            limit: limit + 1
        });
        const page = rows.slice(0, limit);
        const items: InboxItemView[] = page.map((row) => ({
            id: row.id,
            kind: row.kind,
            category: row.category,
            workspaceId: row.workspaceId,
            payload: row.payload,
            link: row.link,
            createdAt: row.createdAt.toISOString(),
            readAt: row.readAt?.toISOString() ?? null
        }));
        const last = page[page.length - 1];
        return {
            items,
            nextCursor: rows.length > limit && last ? encodeCursor(last) : null
        };
    }

    async summary(userId: string): Promise<InboxSummaryView> {
        const counts = await this.items.unreadByCategory(userId);
        const byCategory = Object.fromEntries(
            INBOX_CATEGORIES.map((category) => [
                category,
                counts[category] ?? 0
            ])
        ) as Record<InboxCategory, number>;
        return {
            unread: Object.values(byCategory).reduce((sum, n) => sum + n, 0),
            byCategory
        };
    }

    /** 404 for an id that is not the caller's — the same as one that is not. */
    async markRead(userId: string, id: string): Promise<void> {
        if (!(await this.items.markRead(userId, id))) {
            throw new NotFoundException('No such inbox item.');
        }
    }

    async markAllRead(
        userId: string,
        category?: InboxCategory
    ): Promise<{ marked: number }> {
        return { marked: await this.items.markAllRead(userId, category) };
    }
}
