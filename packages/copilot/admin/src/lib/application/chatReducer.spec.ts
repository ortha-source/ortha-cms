import { chatReducer, initialChatState, type ChatAction } from './chatReducer';
import type { ChatState } from '../domain/types/chat';

/** Applies a sequence of actions, so a test reads as a run's timeline. */
function play(...actions: ChatAction[]): ChatState {
    return actions.reduce(chatReducer, initialChatState);
}

const submit: ChatAction = { type: 'submit', text: 'find posts', localId: '1' };

const started: ChatAction = {
    type: 'event',
    event: {
        type: 'run-started',
        conversationId: 'c1',
        runId: 'r1',
        messageId: 'm1'
    }
};

const done: ChatAction = {
    type: 'event',
    event: {
        type: 'done',
        stopReason: 'end',
        usage: { inputTokens: 1, outputTokens: 2 },
        messageId: 'm2'
    }
};

describe('chatReducer', () => {
    it('appends the user turn and a pending assistant turn on submit', () => {
        const state = play(submit);

        expect(state.busy).toBe(true);
        expect(state.messages).toHaveLength(2);
        expect(state.messages[0]).toMatchObject({
            role: 'user',
            text: 'find posts'
        });
        expect(state.messages[1]).toMatchObject({
            role: 'assistant',
            text: '',
            streaming: true
        });
    });

    it('adopts the conversation id from run-started', () => {
        expect(play(submit, started).conversationId).toBe('c1');
    });

    it('concatenates text deltas in order', () => {
        const state = play(
            submit,
            started,
            { type: 'event', event: { type: 'text-delta', text: 'Hel' } },
            { type: 'event', event: { type: 'text-delta', text: 'lo ' } },
            { type: 'event', event: { type: 'text-delta', text: 'there' } }
        );

        expect(state.messages[1].text).toBe('Hello there');
    });

    it('adds a running step on tool-call and resolves it on tool-result', () => {
        const state = play(
            submit,
            started,
            {
                type: 'event',
                event: {
                    type: 'tool-call',
                    id: 't1',
                    name: 'content.searchEntries',
                    input: { q: 'x' }
                }
            },
            {
                type: 'event',
                event: {
                    type: 'tool-result',
                    id: 't1',
                    name: 'content.searchEntries',
                    ok: true,
                    durationMs: 12,
                    summary: '3 results',
                    output: { total: 3 }
                }
            }
        );

        expect(state.messages[1].steps).toEqual([
            {
                id: 't1',
                name: 'content.searchEntries',
                input: { q: 'x' },
                status: 'ok',
                summary: '3 results',
                output: { total: 3 },
                error: undefined,
                durationMs: 12
            }
        ]);
    });

    it('resolves the matching step only, leaving others running', () => {
        const state = play(
            submit,
            started,
            {
                type: 'event',
                event: { type: 'tool-call', id: 'a', name: 'a', input: {} }
            },
            {
                type: 'event',
                event: { type: 'tool-call', id: 'b', name: 'b', input: {} }
            },
            {
                type: 'event',
                event: {
                    type: 'tool-result',
                    id: 'b',
                    name: 'b',
                    ok: false,
                    durationMs: 1,
                    summary: 'failed',
                    error: 'nope'
                }
            }
        );

        expect(state.messages[1].steps.map((s) => s.status)).toEqual([
            'running',
            'error'
        ]);
    });

    it('clears busy and adopts the server message id on done', () => {
        const state = play(submit, started, done);

        expect(state.busy).toBe(false);
        expect(state.messages[1].id).toBe('m2');
        expect(state.messages[1].streaming).toBe(false);
        expect(state.messages[1].stopReason).toBe('end');
    });

    it('keeps the local id when done carries none', () => {
        const state = play(submit, started, {
            type: 'event',
            event: {
                type: 'done',
                stopReason: 'aborted',
                usage: { inputTokens: 0, outputTokens: 0 }
            }
        });

        expect(state.messages[1].id).toBe('local-assistant-1');
        expect(state.messages[1].stopReason).toBe('aborted');
    });

    it('records an error frame without discarding streamed text', () => {
        const state = play(
            submit,
            started,
            { type: 'event', event: { type: 'text-delta', text: 'partial' } },
            { type: 'event', event: { type: 'error', message: 'boom' } }
        );

        expect(state.messages[1].text).toBe('partial');
        expect(state.messages[1].error).toBe('boom');
    });

    it('ends the turn on a transport failure', () => {
        const state = play(submit, { type: 'failed', message: 'offline' });

        expect(state.busy).toBe(false);
        expect(state.messages[1].streaming).toBe(false);
        expect(state.messages[1].error).toBe('offline');
    });

    // A frame arriving with no assistant turn to attach to must not throw.
    it('ignores an event with no assistant turn present', () => {
        const state = chatReducer(initialChatState, {
            type: 'event',
            event: { type: 'text-delta', text: 'stray' }
        });

        expect(state.messages).toEqual([]);
    });

    it('replaces the transcript on load and clears busy', () => {
        const loaded = play(submit, {
            type: 'load',
            conversationId: 'c9',
            messages: [{ id: 'm', role: 'user', text: 'old', steps: [] }]
        });

        expect(loaded.conversationId).toBe('c9');
        expect(loaded.messages).toHaveLength(1);
        expect(loaded.busy).toBe(false);
    });

    it('resets to an empty new chat', () => {
        expect(play(submit, { type: 'reset' })).toEqual(initialChatState);
    });
});
