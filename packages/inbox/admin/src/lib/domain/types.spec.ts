import { byDay, number, text, type InboxItem } from './types';
import { toInboxItem } from '../infrastructure/inboxGateway';

const row = {
    id: 'i-1',
    kind: 'review.requested',
    category: 'reviews',
    workspaceId: 'ws-1',
    payload: { entryTitle: 'Team page', required: 2, blank: '  ' },
    link: 'workspaces/ws-1/reviews',
    createdAt: '2026-10-28T09:00:00.000Z',
    readAt: null
};

describe('toInboxItem', () => {
    it('turns the server’s app-relative link into an admin path', () => {
        expect(toInboxItem(row).to).toBe('/workspaces/ws-1/reviews');
        expect(toInboxItem({ ...row, link: '/inbox' }).to).toBe('/inbox');
    });

    it('reads unread as a missing readAt', () => {
        expect(toInboxItem(row).read).toBe(false);
        expect(toInboxItem({ ...row, readAt: row.createdAt }).read).toBe(true);
    });

    // An item from a newer server still shows up somewhere.
    it('files an unknown tab under updates', () => {
        expect(toInboxItem({ ...row, category: 'later' }).category).toBe(
            'updates'
        );
    });
});

describe('payload accessors', () => {
    const item = toInboxItem(row);

    it('read a string, treating blank as absent', () => {
        expect(text(item, 'entryTitle')).toBe('Team page');
        expect(text(item, 'blank')).toBeNull();
        expect(text(item, 'required')).toBeNull();
    });

    it('read a number, or 0', () => {
        expect(number(item, 'required')).toBe(2);
        expect(number(item, 'entryTitle')).toBe(0);
    });
});

describe('byDay', () => {
    it('splits on the reader’s own midnight', () => {
        const at = (iso: string): InboxItem => ({
            ...toInboxItem(row),
            id: iso,
            createdAt: iso
        });
        const now = new Date(2026, 9, 28, 15, 0);
        const morning = new Date(2026, 9, 28, 0, 30).toISOString();
        const lastNight = new Date(2026, 9, 27, 23, 30).toISOString();

        const { today, earlier } = byDay([at(morning), at(lastNight)], now);

        expect(today.map((item) => item.id)).toEqual([morning]);
        expect(earlier.map((item) => item.id)).toEqual([lastNight]);
    });
});
