import {
    MAX_OPEN_WINDOWS,
    dockSessions,
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
                unread: false,
                awaiting: false,
                presented: 'dock'
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

    describe('waiting on the user', () => {
        it('marks a chat parked on a permission prompt', () => {
            const state = play(open('a'), {
                type: 'awaiting',
                id: 'a',
                value: true
            });
            expect(state[0].awaiting).toBe(true);
        });

        it('marks it even while it is on screen', () => {
            // Unlike `unread`. A visible chat blocked on a question should say
            // so on its pill too — that is how you tell which of three windows
            // is the one waiting.
            const state = play(open('a'), {
                type: 'awaiting',
                id: 'a',
                value: true
            });
            expect(state[0]).toMatchObject({
                minimized: false,
                awaiting: true
            });
        });

        it('survives being collapsed after it parked', () => {
            // The case an edge-triggered marker missed: parked while visible,
            // collapsed afterwards. The pill must still say it is waiting.
            const state = play(
                open('a'),
                { type: 'awaiting', id: 'a', value: true },
                { type: 'minimize', id: 'a' }
            );
            expect(state[0]).toMatchObject({ minimized: true, awaiting: true });
        });

        it('is not cleared by focusing — only by being answered', () => {
            // Opening the window does not answer the question, so clearing on
            // focus (as `unread` does) would hide a chat that is still stuck.
            const state = play(
                open('a'),
                { type: 'awaiting', id: 'a', value: true },
                { type: 'minimize', id: 'a' },
                { type: 'focus', id: 'a' }
            );
            expect(state[0].awaiting).toBe(true);
        });

        it('clears when the chat reports it is no longer parked', () => {
            const state = play(
                open('a'),
                { type: 'awaiting', id: 'a', value: true },
                { type: 'awaiting', id: 'a', value: false }
            );
            expect(state[0].awaiting).toBe(false);
        });

        it('returns the very same array when the value has not changed', () => {
            // Load-bearing, not an optimisation: the caller reports this from
            // an effect whose callback is a fresh closure each render, so a new
            // array would re-render, re-run the effect and dispatch again —
            // "Maximum update depth exceeded".
            const before = play(open('a'), {
                type: 'awaiting',
                id: 'a',
                value: true
            });
            expect(
                sessionsReducer(before, {
                    type: 'awaiting',
                    id: 'a',
                    value: true
                })
            ).toBe(before);
        });

        it('returns the same array for a chat it does not have', () => {
            const before = play(open('a'));
            expect(
                sessionsReducer(before, {
                    type: 'awaiting',
                    id: 'nope',
                    value: true
                })
            ).toBe(before);
        });
    });

    describe('the full-page surface', () => {
        const present = (
            id: string,
            presented: 'dock' | 'page'
        ): SessionsAction => ({ type: 'present', id, presented });

        it('takes a chat out of the dock entirely', () => {
            // Presented full-page it is on screen, so the dock draws neither a
            // window nor a pill — both would be a second copy of one chat.
            const state = play(open('a'), present('a', 'page'));
            expect(dockSessions(state)).toEqual([]);
            expect(visibleSessions(state)).toEqual([]);
        });

        it('hands it back as a pill, never as a window', () => {
            // A window popping open over whatever page the user just navigated
            // to would be the surface following them around.
            const state = play(
                open('a'),
                present('a', 'page'),
                present('a', 'dock')
            );
            expect(state[0]).toMatchObject({
                presented: 'dock',
                minimized: true
            });
            expect(visibleSessions(state)).toEqual([]);
        });

        it('takes no window slot, so it cannot displace one', () => {
            // Three windows is the cap; a page-presented chat is not a window,
            // and opening one must not minimize somebody's window to make room.
            const state = play(
                open('a'),
                open('b'),
                open('c'),
                open('d'),
                present('d', 'page')
            );
            expect(visibleSessions(state).map((s) => s.id)).toEqual(['b', 'c']);
            expect(state.find((s) => s.id === 'd')?.minimized).toBe(false);
        });

        it('marks a handed-back chat that then finishes', () => {
            // The whole point of the hand-off: you navigated away mid-answer,
            // and the pill has to tell you when it lands.
            const state = play(
                open('a'),
                present('a', 'page'),
                present('a', 'dock'),
                { type: 'activity', id: 'a' }
            );
            expect(state[0].unread).toBe(true);
        });

        it('does not mark one that finishes while you are reading it', () => {
            const state = play(open('a'), present('a', 'page'), {
                type: 'activity',
                id: 'a'
            });
            expect(state[0].unread).toBe(false);
        });

        it('returns the very same array when it is already there', () => {
            // Same reason as `awaiting`: reported from an effect.
            const before = play(open('a'), present('a', 'page'));
            expect(sessionsReducer(before, present('a', 'page'))).toBe(before);
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
