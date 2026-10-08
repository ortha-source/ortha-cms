import { chatsStatus } from './chatsStatus';
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
