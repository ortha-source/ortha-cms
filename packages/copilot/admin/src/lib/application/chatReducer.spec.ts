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
                    name: 'admin_content_search',
                    input: { q: 'x' }
                }
            },
            {
                type: 'event',
                event: {
                    type: 'tool-result',
                    id: 't1',
                    name: 'admin_content_search',
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
                name: 'admin_content_search',
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

    describe('permission prompts', () => {
        const asks: ChatAction = {
            type: 'event',
            event: {
                type: 'tool-permission-request',
                id: 'call-1',
                runId: 'run-1',
                name: 'content_propose_update',
                input: { typeName: 'article', id: 'e1' }
            }
        };
        const result = (ok: boolean): ChatAction => ({
            type: 'event',
            event: {
                type: 'tool-result',
                id: 'call-1',
                name: 'content_propose_update',
                ok,
                durationMs: 1,
                summary: ok ? 'applied' : 'not allowed'
            }
        });

        it('attaches the request to the assistant turn', () => {
            const state = play(submit, started, asks);
            expect(state.messages[1].permissions).toEqual([
                expect.objectContaining({
                    id: 'call-1',
                    runId: 'run-1',
                    name: 'content_propose_update'
                })
            ]);
        });

        it('flags an answer in flight and clears any previous failure', () => {
            const state = play(
                submit,
                started,
                asks,
                { type: 'answered', callId: 'call-1', error: 'not-delivered' },
                { type: 'answering', callId: 'call-1' }
            );
            expect(state.messages[1].permissions?.[0]).toMatchObject({
                deciding: true,
                error: undefined
            });
        });

        it('retires the prompt once the answer lands', () => {
            const state = play(
                submit,
                started,
                asks,
                { type: 'answering', callId: 'call-1' },
                { type: 'answered', callId: 'call-1' }
            );
            expect(state.messages[1].permissions?.[0]).toMatchObject({
                deciding: false,
                answered: true
            });
        });

        it('keeps the prompt answerable when the answer did not reach the run', () => {
            // A 404 means the run had already moved on — but it might not have,
            // and taking the buttons away would strand a still-parked run with
            // no way to answer it.
            const state = play(submit, started, asks, {
                type: 'answered',
                callId: 'call-1',
                error: 'not-delivered'
            });
            expect(state.messages[1].permissions?.[0]).toMatchObject({
                deciding: false,
                error: 'not-delivered'
            });
            expect(state.messages[1].permissions?.[0].answered).toBeUndefined();
        });

        it('retires the prompt when the call produces a result', () => {
            // The server timing out, or another window answering: either way
            // the run moved on, and live buttons that answer nothing are worse
            // than no buttons.
            const state = play(submit, started, asks, result(true));
            expect(state.messages[1].permissions?.[0].answered).toBe(true);
        });

        it('retires it on a refused result too', () => {
            const state = play(submit, started, asks, result(false));
            expect(state.messages[1].permissions?.[0].answered).toBe(true);
            expect(state.messages[1].steps).toEqual([]);
        });

        it('ignores an answer for a request it does not have', () => {
            const before = play(submit, started, asks);
            expect(
                chatReducer(before, { type: 'answered', callId: 'nope' })
            ).toEqual(before);
        });
    });

    describe('proposals', () => {
        const proposed = (
            status: 'pending' | 'accepted' = 'accepted',
            error?: string
        ): ChatAction => ({
            type: 'event',
            event: {
                type: 'proposal',
                id: 'p1',
                toolCallId: 'call-1',
                toolName: 'content_propose_update',
                kind: 'content.entry.update',
                summary: 'Fix the headline',
                target: { typeName: 'article', entryId: 'e1' },
                changes: [{ field: 'title', before: 'Old', after: 'New' }],
                status,
                ...(error ? { error } : {})
            }
        });

        it('attaches a change to the assistant turn', () => {
            const state = play(submit, started, proposed());

            expect(state.messages[1].proposals).toEqual([
                expect.objectContaining({
                    id: 'p1',
                    summary: 'Fix the headline',
                    status: 'accepted'
                })
            ]);
        });

        it('carries the entity the change landed on', () => {
            const state = play(submit, started, {
                type: 'event',
                event: {
                    ...(proposed().event as Extract<
                        ChatAction,
                        { type: 'event' }
                    >['event'] & { type: 'proposal' }),
                    entityId: 'e1'
                }
            });

            expect(state.messages[1].proposals?.[0]).toMatchObject({
                status: 'accepted',
                entityId: 'e1'
            });
        });

        // Since ADR-0009 the engine applies as it drafts, so `pending` on an
        // arriving frame does not mean "waiting" — it means the write failed.
        // The reason has to survive onto the card, because this frame is the
        // only place the user will ever be told.
        it('keeps the failure reason on a change that did not apply', () => {
            const state = play(
                submit,
                started,
                proposed('pending', 'Entry validation failed')
            );

            expect(state.messages[1].proposals?.[0]).toMatchObject({
                status: 'pending',
                error: 'Entry validation failed'
            });
        });

        it('leaves the error unset when the change applied', () => {
            const state = play(submit, started, proposed());
            expect(state.messages[1].proposals?.[0].error).toBeUndefined();
        });

        it('appends several changes from one turn in order', () => {
            const second: ChatAction = {
                type: 'event',
                event: {
                    ...(proposed().event as Extract<
                        ChatAction,
                        { type: 'event' }
                    >['event'] & { type: 'proposal' }),
                    id: 'p2',
                    summary: 'Fix the standfirst'
                }
            };
            const state = play(submit, started, proposed(), second);

            expect(state.messages[1].proposals?.map((p) => p.id)).toEqual([
                'p1',
                'p2'
            ]);
        });
    });
});
