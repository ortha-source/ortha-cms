import type { CopilotStoreState } from './copilotStore';
import type { CopilotSession } from './sessions';
import type { ChatState } from '../domain/types/chat';
import { threadActivity } from './threadActivity';

function session(overrides: Partial<CopilotSession> = {}): CopilotSession {
    return {
        id: 's1',
        conversationId: 'c1',
        title: null,
        minimized: false,
        unread: false,
        awaiting: false,
        presented: 'page',
        choice: null,
        choicePinned: false,
        context: null,
        skills: [],
        ...overrides
    };
}

function chat(overrides: Partial<ChatState> = {}): ChatState {
    return { conversationId: 'c1', messages: [], busy: false, ...overrides };
}

const parked = {
    id: 'm1',
    role: 'assistant',
    content: '',
    permissions: [{ answered: false }]
} as unknown as ChatState['messages'][number];

describe('threadActivity', () => {
    it('marks nothing for a quiet thread', () => {
        const state: CopilotStoreState = {
            sessions: [session()],
            chats: { s1: chat() }
        };
        expect(threadActivity(state).size).toBe(0);
    });

    it('marks a streaming thread as working', () => {
        const state: CopilotStoreState = {
            sessions: [session()],
            chats: { s1: chat({ busy: true }) }
        };
        expect(threadActivity(state).get('c1')).toBe('working');
    });

    it('marks a run parked on a question as awaiting, though it is busy too', () => {
        const state: CopilotStoreState = {
            sessions: [session()],
            chats: { s1: chat({ busy: true, messages: [parked] }) }
        };
        expect(threadActivity(state).get('c1')).toBe('awaiting');
    });

    it('takes the session’s own awaiting flag', () => {
        const state: CopilotStoreState = {
            sessions: [session({ awaiting: true })],
            chats: { s1: chat() }
        };
        expect(threadActivity(state).get('c1')).toBe('awaiting');
    });

    it('lets awaiting win when two windows show one thread', () => {
        const state: CopilotStoreState = {
            sessions: [session(), session({ id: 's2', awaiting: true })],
            chats: { s1: chat({ busy: true }), s2: chat() }
        };
        expect(threadActivity(state).get('c1')).toBe('awaiting');
    });

    it('skips a chat that has no thread yet', () => {
        const state: CopilotStoreState = {
            sessions: [session({ conversationId: null })],
            chats: { s1: chat({ conversationId: null, busy: true }) }
        };
        expect(threadActivity(state).size).toBe(0);
    });
});
