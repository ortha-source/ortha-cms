import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InboxService } from './inbox.service';
import type { StoredInboxItem } from '../infrastructure/inbox-item.repository';

function item(id: string, at: string): StoredInboxItem {
    return {
        id,
        kind: 'review.requested',
        category: 'reviews',
        workspaceId: 'ws-1',
        payload: {},
        link: 'workspaces/ws-1/reviews',
        createdAt: new Date(at),
        readAt: null
    };
}

function make(rows: StoredInboxItem[] = []) {
    const calls: unknown[] = [];
    const repository = {
        page: jest.fn(async (_user: string, options: unknown) => {
            calls.push(options);
            return rows;
        }),
        unreadByCategory: jest.fn(async () => ({ reviews: 2, alarms: 1 })),
        markRead: jest.fn(async () => false),
        markAllRead: jest.fn(async () => 3)
    };
    return {
        service: new InboxService(repository as never),
        repository,
        calls
    };
}

describe('InboxService', () => {
    it('fetches one past the page and hands back a cursor to the next', async () => {
        const rows = [
            item('c', '2026-10-28T10:00:00.000Z'),
            item('b', '2026-10-28T09:00:00.000Z'),
            item('a', '2026-10-28T08:00:00.000Z')
        ];
        const { service, calls } = make(rows);

        const page = await service.page('u-1', { limit: 2 });

        expect(calls[0]).toMatchObject({ limit: 3 });
        expect(page.items.map((row) => row.id)).toEqual(['c', 'b']);
        expect(page.nextCursor).toBe('2026-10-28T09:00:00.000Z|b');

        await service.page('u-1', {
            limit: 2,
            before: page.nextCursor ?? undefined
        });
        expect(calls[1]).toMatchObject({
            before: { createdAt: new Date('2026-10-28T09:00:00.000Z'), id: 'b' }
        });
    });

    it('says the last page is the last', async () => {
        const { service } = make([item('a', '2026-10-28T08:00:00.000Z')]);
        expect((await service.page('u-1', { limit: 2 })).nextCursor).toBeNull();
    });

    it('refuses a cursor it did not issue', async () => {
        const { service } = make();
        await expect(
            service.page('u-1', { before: 'not-a-cursor' })
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    // Every tab is present at 0, so the admin never reads `undefined` as "none".
    it('fills every tab in the unread summary', async () => {
        const { service } = make();
        await expect(service.summary('u-1')).resolves.toEqual({
            unread: 3,
            byCategory: { reviews: 2, alarms: 1, updates: 0 }
        });
    });

    it('answers 404 for an item that is not the caller’s', async () => {
        const { service } = make();
        await expect(service.markRead('u-1', 'x')).rejects.toBeInstanceOf(
            NotFoundException
        );
    });
});
