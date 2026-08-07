import type { ModelRequest, ModelStreamEvent } from '@ortha-cms/copilot-domain';
import { createFakeProvider } from './fake-provider';

const request: ModelRequest = {
    model: 'fake',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }],
    maxOutputTokens: 1024
};

async function drain(
    events: AsyncIterable<ModelStreamEvent>
): Promise<ModelStreamEvent[]> {
    const collected: ModelStreamEvent[] = [];
    for await (const event of events) {
        collected.push(event);
    }
    return collected;
}

/**
 * The fake provider is what CI runs the copilot loop against, so its
 * determinism is load-bearing: a flaky fake would make every downstream
 * assertion flaky too.
 */
describe('createFakeProvider', () => {
    it('streams the canned reply in dev mode, repeatedly', async () => {
        const provider = createFakeProvider();

        const first = await drain(provider.stream(request));
        const second = await drain(provider.stream(request));

        expect(first).toEqual(second);
        expect(first.at(-1)).toMatchObject({ type: 'done', stopReason: 'end' });
        expect(provider.calls).toHaveLength(2);
    });

    it('reassembles to the scripted text exactly', async () => {
        const provider = createFakeProvider({
            script: [{ text: 'I found 3 matching articles.' }],
            chunkSize: 3
        });

        const events = await drain(provider.stream(request));
        const text = events
            .filter((event) => event.type === 'text-delta')
            .map((event) => event.text)
            .join('');

        expect(text).toBe('I found 3 matching articles.');
    });

    it('plays scripted turns in order and infers the stop reason', async () => {
        const provider = createFakeProvider({
            script: [
                {
                    toolCalls: [
                        {
                            name: 'content.searchEntries',
                            input: { q: 'launch' }
                        }
                    ]
                },
                { text: 'Found it.' }
            ]
        });

        const turnOne = await drain(provider.stream(request));
        expect(turnOne).toContainEqual({
            type: 'tool-call',
            id: 'fake-tool-0-0',
            name: 'content.searchEntries',
            input: { q: 'launch' }
        });
        expect(turnOne.at(-1)).toMatchObject({ stopReason: 'tool_use' });

        const turnTwo = await drain(provider.stream(request));
        expect(turnTwo.at(-1)).toMatchObject({ stopReason: 'end' });
    });

    it('throws once a supplied script runs out, rather than inventing a turn', async () => {
        const provider = createFakeProvider({ script: [{ text: 'once' }] });
        await drain(provider.stream(request));

        await expect(drain(provider.stream(request))).rejects.toThrow(
            /script exhausted/
        );
    });

    it('records every request it served, for negative-path assertions', async () => {
        const provider = createFakeProvider();

        await drain(
            provider.stream({
                ...request,
                tools: [
                    {
                        name: 'content.searchEntries',
                        description: 'Search entries',
                        inputSchema: { type: 'object' }
                    }
                ]
            })
        );

        expect(provider.calls[0].tools?.map((tool) => tool.name)).toEqual([
            'content.searchEntries'
        ]);
    });

    it('ends with `aborted` when the signal is already aborted', async () => {
        const provider = createFakeProvider({
            script: [{ text: 'never seen' }]
        });

        const events = await drain(
            provider.stream(request, AbortSignal.abort())
        );

        expect(events).toEqual([
            {
                type: 'done',
                stopReason: 'aborted',
                usage: { inputTokens: 0, outputTokens: 0 }
            }
        ]);
    });

    it('reports overridable capabilities so degraded mode is testable', async () => {
        const provider = createFakeProvider({
            capabilities: { toolCalling: false, contextWindow: 4_096 }
        });

        await expect(provider.capabilities()).resolves.toMatchObject({
            toolCalling: false,
            streaming: true,
            contextWindow: 4_096
        });
    });

    it('rewinds the script and clears calls on reset', async () => {
        const provider = createFakeProvider({ script: [{ text: 'once' }] });
        await drain(provider.stream(request));

        provider.reset();

        expect(provider.calls).toHaveLength(0);
        await expect(drain(provider.stream(request))).resolves.toHaveLength(2);
    });

    it('advertises a single `fake` model by default', () => {
        expect(createFakeProvider().models()).toEqual(['fake']);
    });

    it('advertises declared models and rejects one it was not given', async () => {
        const provider = createFakeProvider({ models: ['small', 'large'] });

        expect(provider.models()).toEqual(['small', 'large']);
        await expect(provider.capabilities('large')).resolves.toMatchObject({
            model: 'large'
        });
        await expect(
            drain(provider.stream({ ...request, model: 'huge' }))
        ).rejects.toThrow(/not offered by this copilot provider/);
    });
});
