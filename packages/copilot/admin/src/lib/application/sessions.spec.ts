import {
    MAX_OPEN_WINDOWS,
    sessionsReducer,
    visibleSessions,
    type CopilotSession,
    type SessionsAction
} from './sessions';

/** Fold a script of actions onto an empty desk. */
function play(...actions: SessionsAction[]): CopilotSession[] {
    return actions.reduce(sessionsReducer, [] as CopilotSession[]);
}

const open = (id: string): SessionsAction => ({ type: 'open', id });

describe('sessionsReducer', () => {
    it('opens a chat visible, untitled and unmarked', () => {
        expect(play(open('a'))).toEqual([
            {
                id: 'a',
                conversationId: null,
                title: null,
                minimized: false,
                unread: false
            }
        ]);
    });

    it('keeps open order, so a window never jumps slots', () => {
        const state = play(open('a'), open('b'));
        expect(state.map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('closes only the chat named', () => {
        const state = play(open('a'), open('b'), { type: 'close', id: 'a' });
        expect(state.map((s) => s.id)).toEqual(['b']);
    });

    describe('the window cap', () => {
        it('minimizes the oldest visible rather than refusing the new one', () => {
            const ids = ['a', 'b', 'c', 'd'];
            const state = play(...ids.map(open));

            // All four still exist — a minimized chat keeps streaming, so
            // nothing was thrown away.
            expect(state).toHaveLength(4);
            expect(visibleSessions(state).map((s) => s.id)).toEqual([
                'b',
                'c',
                'd'
            ]);
            expect(visibleSessions(state)).toHaveLength(MAX_OPEN_WINDOWS);
        });

        it('never minimizes the chat that caused the cap', () => {
            const state = play(...'abcdef'.split('').map(open));
            expect(state.find((s) => s.id === 'f')?.minimized).toBe(false);
        });

        it('minimizes the oldest when focusing brings one back', () => {
            const state = play(
                ...'abcd'.split('').map(open),
                // 'a' was minimized by the cap; bringing it back has to cost
                // something, and it costs the oldest of the others.
                { type: 'focus', id: 'a' }
            );

            expect(visibleSessions(state).map((s) => s.id)).toEqual([
                'a',
                'c',
                'd'
            ]);
        });
    });

    describe('markers', () => {
        it('marks a chat that finished while off screen', () => {
            const state = play(
                open('a'),
                { type: 'minimize', id: 'a' },
                { type: 'activity', id: 'a' }
            );
            expect(state[0].unread).toBe(true);
        });

        it('does not mark the chat the user is looking at', () => {
            // A badge on the window you are reading is noise — and it teaches
            // people to ignore the badge that does mean something.
            const state = play(open('a'), { type: 'activity', id: 'a' });
            expect(state[0].unread).toBe(false);
        });

        it('clears the marker on focus', () => {
            const state = play(
                open('a'),
                { type: 'minimize', id: 'a' },
                { type: 'activity', id: 'a' },
                { type: 'focus', id: 'a' }
            );
            expect(state[0]).toMatchObject({ minimized: false, unread: false });
        });

        it('keeps the marker while it stays minimized', () => {
            const state = play(
                open('a'),
                { type: 'minimize', id: 'a' },
                { type: 'activity', id: 'a' },
                { type: 'activity', id: 'a' }
            );
            expect(state[0].unread).toBe(true);
        });
    });

    describe('toggle', () => {
        it('minimizes a visible chat', () => {
            const state = play(open('a'), { type: 'toggle', id: 'a' });
            expect(state[0].minimized).toBe(true);
        });

        it('restores and clears the marker on a minimized one', () => {
            const state = play(
                open('a'),
                { type: 'minimize', id: 'a' },
                { type: 'activity', id: 'a' },
                { type: 'toggle', id: 'a' }
            );
            expect(state[0]).toMatchObject({ minimized: false, unread: false });
        });

        it('ignores a chat that is not open', () => {
            const before = play(open('a'));
            expect(
                sessionsReducer(before, { type: 'toggle', id: 'nope' })
            ).toEqual(before);
        });
    });

    describe('reopening a saved thread', () => {
        it('focuses the window already showing it instead of duplicating', () => {
            // Two windows on one thread would hold two transcripts that
            // immediately disagree about what was said.
            const state = play(
                { type: 'open', id: 'a', conversationId: 'c1' },
                { type: 'minimize', id: 'a' },
                { type: 'open', id: 'b', conversationId: 'c1' }
            );

            expect(state).toHaveLength(1);
            expect(state[0]).toMatchObject({ id: 'a', minimized: false });
        });

        it('opens a second window for a different thread', () => {
            const state = play(
                { type: 'open', id: 'a', conversationId: 'c1' },
                { type: 'open', id: 'b', conversationId: 'c2' }
            );
            expect(state).toHaveLength(2);
        });

        it('does not match two untitled new chats to each other', () => {
            // Both have `conversationId: null`; matching on it would collapse
            // every unsaved chat into one window.
            expect(play(open('a'), open('b'))).toHaveLength(2);
        });
    });

    describe('meta', () => {
        it('adopts the thread id and title the server gave', () => {
            const state = play(open('a'), {
                type: 'meta',
                id: 'a',
                conversationId: 'c1',
                title: 'Fix the headline'
            });
            expect(state[0]).toMatchObject({
                conversationId: 'c1',
                title: 'Fix the headline'
            });
        });

        it('leaves a field alone when the action omits it', () => {
            const state = play(
                open('a'),
                { type: 'meta', id: 'a', title: 'Named' },
                { type: 'meta', id: 'a', conversationId: 'c1' }
            );
            expect(state[0]).toMatchObject({
                title: 'Named',
                conversationId: 'c1'
            });
        });
    });
});
