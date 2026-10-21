import { chatsAwaiting } from './chatsStatus';
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

describe('chatsAwaiting', () => {
    it('is zero with no chats', () => {
        expect(chatsAwaiting([])).toBe(0);
    });

    it('counts only the chats parked on a question', () => {
        expect(
            chatsAwaiting([
                session({ id: 'a' }),
                session({ id: 'b', unread: true }),
                session({ id: 'c', awaiting: true }),
                session({ id: 'd', awaiting: true, presented: 'page' })
            ])
        ).toBe(2);
    });

    // "Finished" asks nothing of the user, so it is not a marker on the way in.
    it('ignores a chat that only finished', () => {
        expect(chatsAwaiting([session({ unread: true })])).toBe(0);
    });

    it('counts a chat that is both unread and awaiting once', () => {
        expect(chatsAwaiting([session({ unread: true, awaiting: true })])).toBe(
            1
        );
    });
});
