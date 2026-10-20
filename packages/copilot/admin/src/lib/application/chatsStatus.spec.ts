import { chatsStatus, switcherSessions } from './chatsStatus';
import type { CopilotSession } from './sessions';

/** A session, with only the fields the status looks at spelled out. */
function session(overrides: Partial<CopilotSession> = {}): CopilotSession {
    return {
        id: 'a',
        conversationId: null,
        title: null,
        minimized: false,
        unread: false,
        awaiting: false,
        presented: 'dock',
        choice: null,
        choicePinned: false,
        context: null,
        skills: [],
        ...overrides
    };
}

describe('chatsStatus', () => {
    it('is empty with no chats', () => {
        expect(chatsStatus([])).toEqual({
            count: 0,
            attention: 0,
            awaiting: false
        });
    });

    it('counts every chat, but only the ones wanting attention as such', () => {
        expect(
            chatsStatus([
                session({ id: 'a' }),
                session({ id: 'b', unread: true }),
                session({ id: 'c', awaiting: true })
            ])
        ).toEqual({ count: 3, attention: 2, awaiting: true });
    });

    it('counts a chat that is both unread and awaiting once', () => {
        expect(
            chatsStatus([session({ unread: true, awaiting: true })]).attention
        ).toBe(1);
    });

    it('is not awaiting when the only marker is "finished"', () => {
        expect(chatsStatus([session({ unread: true })]).awaiting).toBe(false);
    });
});

describe('switcherSessions', () => {
    // Opening a running chat from the rail moves it to the page; the switch
    // must not count one fewer for it.
    it('counts the chat the Agents page is showing', () => {
        expect(
            switcherSessions([
                session({ id: 'a' }),
                session({
                    id: 'b',
                    presented: 'page',
                    conversationId: 'c1'
                })
            ]).map((s) => s.id)
        ).toEqual(['a', 'b']);
    });

    // The view's empty state is not a conversation.
    it('leaves out the page’s unsaved new chat', () => {
        expect(
            switcherSessions([
                session({ id: 'a' }),
                session({ id: 'b', presented: 'page', conversationId: null })
            ]).map((s) => s.id)
        ).toEqual(['a']);
    });

    it('keeps every dock chat, saved or not', () => {
        expect(
            switcherSessions([
                session({ id: 'a', conversationId: null }),
                session({ id: 'b', conversationId: 'c2' })
            ])
        ).toHaveLength(2);
    });
});
