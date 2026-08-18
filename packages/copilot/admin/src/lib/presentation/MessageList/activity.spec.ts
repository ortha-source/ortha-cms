import { turnActivity } from './activity';
import type { ChatBlock, ChatMessage } from '../../domain/types/chat';

/** A streaming assistant turn made of `blocks`. */
function streaming(
    blocks: ChatBlock[],
    extra: Partial<ChatMessage> = {}
): ChatMessage {
    return {
        id: 'a1',
        role: 'assistant',
        text: '',
        blocks,
        streaming: true,
        ...extra
    };
}

const step = (
    id: string,
    name: string,
    status: 'running' | 'ok' | 'error'
): ChatBlock => ({
    kind: 'step',
    id,
    step: { id, name, input: {}, status }
});

const text = (id: string, value: string): ChatBlock => ({
    kind: 'text',
    id,
    text: value
});

describe('turnActivity', () => {
    it('says nothing about a turn that has finished', () => {
        expect(
            turnActivity({
                id: 'a1',
                role: 'assistant',
                text: '',
                blocks: [text('t1', 'Done.')]
            })
        ).toBeNull();
    });

    it('falls back to thinking before the first frame lands', () => {
        // The one gap where "Thinking…" really is all anyone can say: the turn
        // has been submitted and nothing has come back.
        expect(turnActivity(streaming([]))).toEqual({ kind: 'thinking' });
    });

    it('names the call that just finished instead of saying thinking', () => {
        expect(
            turnActivity(streaming([step('c1', 'admin_content_search', 'ok')]))
        ).toEqual({
            kind: 'after-step',
            step: expect.objectContaining({ name: 'admin_content_search' })
        });
    });

    it('names the last call even after prose was already written', () => {
        // The regression this replaces: the old condition stood down for the
        // whole turn as soon as any prose existed, so a turn that explained
        // itself, searched, and then thought showed nothing at all.
        expect(
            turnActivity(
                streaming([
                    text('t1', 'Let me look that up.'),
                    step('c1', 'admin_content_search', 'ok')
                ])
            )
        ).toEqual({
            kind: 'after-step',
            step: expect.objectContaining({ name: 'admin_content_search' })
        });
    });

    it('looks past a change card to the call that produced it', () => {
        // A `proposal` block is emitted straight after its step, so the newest
        // block after a write is the receipt rather than the call.
        expect(
            turnActivity(
                streaming([
                    step('c1', 'content_propose_update', 'ok'),
                    {
                        kind: 'proposal',
                        id: 'p1',
                        proposal: {
                            id: 'p1',
                            toolCallId: 'c1',
                            toolName: 'content_propose_update',
                            kind: 'content.entry.update',
                            summary: 'Set a summary',
                            target: {},
                            status: 'accepted'
                        }
                    }
                ])
            )
        ).toEqual({
            kind: 'after-step',
            step: expect.objectContaining({ name: 'content_propose_update' })
        });
    });

    it('stands down while a step is running — that step has its own spinner', () => {
        expect(
            turnActivity(
                streaming([step('c1', 'content_propose_update', 'running')])
            )
        ).toBeNull();
    });

    it('stands down while prose is arriving — the words are the status', () => {
        expect(
            turnActivity(
                streaming([
                    step('c1', 'admin_content_search', 'ok'),
                    text('t1', 'Three articles have no summary')
                ])
            )
        ).toBeNull();
    });

    it('stands down on a failed turn, which has an alert instead', () => {
        expect(
            turnActivity(streaming([], { error: 'The run failed.' }))
        ).toBeNull();
    });

    it('stands down while a permission prompt is unanswered', () => {
        // The run is blocked on the user rather than working, and the prompt is
        // the one control that matters — a pulsing status line beside it moves
        // the eye away from it.
        expect(
            turnActivity(
                streaming([], {
                    permissions: [
                        {
                            id: 'c1',
                            runId: 'r1',
                            name: 'content_propose_update',
                            input: {}
                        }
                    ]
                })
            )
        ).toBeNull();
    });

    it('resumes once that prompt has been answered', () => {
        expect(
            turnActivity(
                streaming([step('c1', 'content_propose_update', 'ok')], {
                    permissions: [
                        {
                            id: 'c1',
                            runId: 'r1',
                            name: 'content_propose_update',
                            input: {},
                            answered: true
                        }
                    ]
                })
            )
        ).toEqual({
            kind: 'after-step',
            step: expect.objectContaining({ name: 'content_propose_update' })
        });
    });
});
