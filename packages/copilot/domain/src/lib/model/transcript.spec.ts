import type { ModelMessage } from './model-message';
import { normalizeTranscript } from './transcript';

const use = (id: string) => ({
    type: 'tool_use' as const,
    id,
    name: 'content_search',
    input: {}
});
const result = (id: string) => ({
    type: 'tool_result' as const,
    toolUseId: id,
    content: 'ok'
});
const text = (value: string) => ({ type: 'text' as const, text: value });

describe('normalizeTranscript', () => {
    it('leaves a transcript with no tool calls alone', () => {
        const messages: ModelMessage[] = [
            { role: 'user', content: [text('hello')] },
            { role: 'assistant', content: [text('hi')] }
        ];
        expect(normalizeTranscript(messages)).toEqual(messages);
    });

    // The defect the Anthropic API rejects: a stored assistant turn carries the
    // tool results alongside the uses that asked for them.
    it('moves tool results off the assistant turn onto a user turn', () => {
        const stored: ModelMessage[] = [
            { role: 'user', content: [text('find the post')] },
            {
                role: 'assistant',
                content: [
                    text('Looking.'),
                    use('a'),
                    result('a'),
                    text('Done.')
                ]
            }
        ];

        expect(normalizeTranscript(stored)).toEqual([
            { role: 'user', content: [text('find the post')] },
            { role: 'assistant', content: [text('Looking.'), use('a')] },
            { role: 'user', content: [result('a')] },
            { role: 'assistant', content: [text('Done.')] }
        ]);
    });

    // One row holds every step of a run, so the split has to pair them up
    // step by step rather than hoisting all the results to the end.
    it('pairs each step of a multi-step run in order', () => {
        const stored: ModelMessage[] = [
            {
                role: 'assistant',
                content: [use('a'), result('a'), use('b'), result('b')]
            }
        ];

        expect(normalizeTranscript(stored)).toEqual([
            { role: 'assistant', content: [use('a')] },
            { role: 'user', content: [result('a')] },
            { role: 'assistant', content: [use('b')] },
            { role: 'user', content: [result('b')] }
        ]);
    });

    it('keeps parallel calls of one step in a single result turn', () => {
        const stored: ModelMessage[] = [
            {
                role: 'assistant',
                content: [use('a'), use('b'), result('a'), result('b')]
            }
        ];

        expect(normalizeTranscript(stored)).toEqual([
            { role: 'assistant', content: [use('a'), use('b')] },
            { role: 'user', content: [result('a'), result('b')] }
        ]);
    });

    // What an aborted run leaves behind: the model asked, nothing ran.
    it('drops a tool_use that never got a result', () => {
        const stored: ModelMessage[] = [
            { role: 'user', content: [text('go')] },
            { role: 'assistant', content: [text('Working.'), use('a')] }
        ];

        expect(normalizeTranscript(stored)).toEqual([
            { role: 'user', content: [text('go')] },
            { role: 'assistant', content: [text('Working.')] }
        ]);
    });

    it('drops a turn left empty by an unpaired tool_use', () => {
        const stored: ModelMessage[] = [
            { role: 'user', content: [text('go')] },
            { role: 'assistant', content: [use('a')] }
        ];

        expect(normalizeTranscript(stored)).toEqual([
            { role: 'user', content: [text('go')] }
        ]);
    });

    it('drops a tool_result with no matching tool_use', () => {
        const stored: ModelMessage[] = [
            { role: 'assistant', content: [text('hi'), result('ghost')] }
        ];

        expect(normalizeTranscript(stored)).toEqual([
            { role: 'assistant', content: [text('hi')] }
        ]);
    });

    it('does not mutate the transcript it was given', () => {
        const stored: ModelMessage[] = [
            { role: 'assistant', content: [use('a'), result('a')] }
        ];
        const snapshot = JSON.parse(JSON.stringify(stored));

        normalizeTranscript(stored);

        expect(stored).toEqual(snapshot);
    });
});
