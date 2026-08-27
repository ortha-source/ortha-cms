import { filterConversations, groupConversations } from './groupConversations';
import type { CopilotConversation } from './useConversations';

/** A thread, named and stamped; everything else is filler the rail ignores. */
function thread(
    id: string,
    updatedAt: string,
    title: string | null = null
): CopilotConversation {
    return {
        id,
        title,
        surface: 'chat',
        archived: false,
        modelChoice: null,
        createdAt: updatedAt,
        updatedAt
    };
}

describe('groupConversations', () => {
    // A local-time "now" so the calendar-day arithmetic is exercised in the
    // same frame the browser would use.
    const now = new Date(2026, 2, 15, 9, 0, 0);

    it('buckets by calendar day, not by elapsed hours', () => {
        // 11pm the night before is *yesterday* at 9am, even though only ten
        // hours have passed. This is the case the bucket exists for.
        const groups = groupConversations(
            [
                thread('a', new Date(2026, 2, 15, 0, 30).toISOString()),
                thread('b', new Date(2026, 2, 14, 23, 0).toISOString())
            ],
            now
        );

        expect(groups.map((group) => group.id)).toEqual(['today', 'yesterday']);
        expect(groups[0].conversations.map((c) => c.id)).toEqual(['a']);
        expect(groups[1].conversations.map((c) => c.id)).toEqual(['b']);
    });

    it('splits the older buckets at 7 and 30 days', () => {
        const groups = groupConversations(
            [
                thread('week-edge', new Date(2026, 2, 8).toISOString()),
                thread('month', new Date(2026, 2, 7).toISOString()),
                thread('month-edge', new Date(2026, 1, 13).toISOString()),
                thread('older', new Date(2026, 1, 12).toISOString())
            ],
            now
        );

        expect(
            groups.map((group) => [
                group.id,
                group.conversations.map((c) => c.id)
            ])
        ).toEqual([
            ['week', ['week-edge']],
            ['month', ['month', 'month-edge']],
            ['older', ['older']]
        ]);
    });

    it('drops empty buckets rather than heading nothing', () => {
        const groups = groupConversations(
            [thread('a', new Date(2026, 1, 1).toISOString())],
            now
        );
        expect(groups.map((group) => group.id)).toEqual(['older']);
    });

    it('keeps the server’s order inside a bucket', () => {
        const groups = groupConversations(
            [
                thread('newest', new Date(2026, 2, 15, 8).toISOString()),
                thread('older', new Date(2026, 2, 15, 2).toISOString())
            ],
            now
        );
        expect(groups[0].conversations.map((c) => c.id)).toEqual([
            'newest',
            'older'
        ]);
    });

    it('places a future timestamp under Today rather than out of range', () => {
        const groups = groupConversations(
            [thread('skewed', new Date(2026, 2, 16).toISOString())],
            now
        );
        expect(groups.map((group) => group.id)).toEqual(['today']);
    });

    it('places an unparseable timestamp under Older instead of Today', () => {
        const groups = groupConversations(
            [thread('broken', 'not-a-date')],
            now
        );
        expect(groups.map((group) => group.id)).toEqual(['older']);
    });

    it('returns nothing for no threads', () => {
        expect(groupConversations([], now)).toEqual([]);
    });
});

describe('filterConversations', () => {
    const conversations = [
        thread('a', '2026-03-15T09:00:00.000Z', 'Invoice copy review'),
        thread('b', '2026-03-15T09:00:00.000Z', 'Draft the launch post'),
        thread('c', '2026-03-15T09:00:00.000Z')
    ];

    it('returns everything for an empty or blank query', () => {
        expect(filterConversations(conversations, '')).toHaveLength(3);
        expect(filterConversations(conversations, '   ')).toHaveLength(3);
    });

    it('matches the title case-insensitively, anywhere in it', () => {
        expect(
            filterConversations(conversations, 'INVOICE').map((c) => c.id)
        ).toEqual(['a']);
        expect(
            filterConversations(conversations, 'launch').map((c) => c.id)
        ).toEqual(['b']);
    });

    it('drops untitled threads once a query is typed', () => {
        expect(
            filterConversations(conversations, 'e').map((c) => c.id)
        ).toEqual(['a', 'b']);
    });
});
