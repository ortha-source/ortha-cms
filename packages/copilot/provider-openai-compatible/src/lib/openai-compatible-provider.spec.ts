import type { ModelRequest, ModelStreamEvent } from '@ortha-cms/copilot-domain';
import { createOpenAiCompatibleProvider } from './openai-compatible-provider';

/** Builds an SSE response body from chunk objects, plus the `[DONE]` sentinel. */
function sseResponse(chunks: unknown[], status = 200): Response {
    const text =
        chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') +
        'data: [DONE]\n\n';
    return new Response(text, {
        status,
        headers: { 'content-type': 'text/event-stream' }
    });
}

const request: ModelRequest = {
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    maxOutputTokens: 256
};

const provider = () =>
    createOpenAiCompatibleProvider({
        baseUrl: 'http://localhost:11434/v1/',
        model: 'llama3.1'
    });

async function drain(
    events: AsyncIterable<ModelStreamEvent>
): Promise<ModelStreamEvent[]> {
    const collected: ModelStreamEvent[] = [];
    for await (const event of events) {
        collected.push(event);
    }
    return collected;
}

function lastBody(): Record<string, unknown> {
    const call = jest.mocked(globalThis.fetch).mock.calls.at(-1);
    return JSON.parse(String(call?.[1]?.body)) as Record<string, unknown>;
}

/**
 * Streaming normalisation is the genuine work in this adapter (ADR-0004
 * "Consequences"): two wire formats, two tool-call encodings and two usage
 * shapes have to collapse to one internal event stream.
 */
describe('createOpenAiCompatibleProvider', () => {
    beforeEach(() => {
        globalThis.fetch = jest.fn();
    });

    it('posts to <baseUrl>/chat/completions without doubling the slash', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(sseResponse([]));

        await drain(provider().stream(request));

        expect(jest.mocked(globalThis.fetch).mock.calls[0][0]).toBe(
            'http://localhost:11434/v1/chat/completions'
        );
    });

    it('forwards text deltas in order', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(
            sseResponse([
                { choices: [{ delta: { content: 'Hel' } }] },
                { choices: [{ delta: { content: 'lo' } }] },
                { choices: [{ delta: {}, finish_reason: 'stop' }] }
            ])
        );

        const events = await drain(provider().stream(request));

        expect(events).toEqual([
            { type: 'text-delta', text: 'Hel' },
            { type: 'text-delta', text: 'lo' },
            {
                type: 'done',
                stopReason: 'end',
                usage: { inputTokens: 0, outputTokens: 0 }
            }
        ]);
    });

    it('assembles a tool call from argument fragments and emits it once', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(
            sseResponse([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: 'call_1',
                                        function: {
                                            name: 'content.searchEntries',
                                            arguments: '{"q":'
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                },
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        function: { arguments: '"launch"}' }
                                    }
                                ]
                            }
                        }
                    ]
                },
                { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }
            ])
        );

        const events = await drain(provider().stream(request));

        expect(events.filter((event) => event.type === 'tool-call')).toEqual([
            {
                type: 'tool-call',
                id: 'call_1',
                name: 'content.searchEntries',
                input: { q: 'launch' }
            }
        ]);
        expect(events.at(-1)).toMatchObject({ stopReason: 'tool_use' });
    });

    it('emits parallel tool calls in index order', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(
            sseResponse([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 1,
                                        id: 'b',
                                        function: {
                                            name: 'second',
                                            arguments: '{}'
                                        }
                                    },
                                    {
                                        index: 0,
                                        id: 'a',
                                        function: {
                                            name: 'first',
                                            arguments: '{}'
                                        }
                                    }
                                ]
                            },
                            finish_reason: 'tool_calls'
                        }
                    ]
                }
            ])
        );

        const events = await drain(provider().stream(request));

        expect(
            events
                .filter((event) => event.type === 'tool-call')
                .map((event) => event.name)
        ).toEqual(['first', 'second']);
    });

    it('falls back to an empty input when the model emits malformed JSON', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(
            sseResponse([
                {
                    choices: [
                        {
                            delta: {
                                tool_calls: [
                                    {
                                        index: 0,
                                        id: 'call_1',
                                        function: {
                                            name: 'broken',
                                            arguments: '{not json'
                                        }
                                    }
                                ]
                            },
                            finish_reason: 'tool_calls'
                        }
                    ]
                }
            ])
        );

        const events = await drain(provider().stream(request));

        expect(events).toContainEqual({
            type: 'tool-call',
            id: 'call_1',
            name: 'broken',
            input: {}
        });
    });

    it('reads usage from the trailing usage-only chunk', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(
            sseResponse([
                {
                    choices: [
                        { delta: { content: 'x' }, finish_reason: 'stop' }
                    ]
                },
                {
                    choices: [],
                    usage: {
                        prompt_tokens: 120,
                        completion_tokens: 7,
                        prompt_tokens_details: { cached_tokens: 64 }
                    }
                }
            ])
        );

        const events = await drain(provider().stream(request));

        expect(events.at(-1)).toEqual({
            type: 'done',
            stopReason: 'end',
            usage: { inputTokens: 120, outputTokens: 7, cachedInputTokens: 64 }
        });
    });

    it('maps `length` to max_tokens and `content_filter` to refusal', async () => {
        for (const [finish, expected] of [
            ['length', 'max_tokens'],
            ['content_filter', 'refusal']
        ] as const) {
            jest.mocked(globalThis.fetch).mockResolvedValue(
                sseResponse([
                    { choices: [{ delta: {}, finish_reason: finish }] }
                ])
            );

            const events = await drain(provider().stream(request));
            expect(events.at(-1)).toMatchObject({ stopReason: expected });
        }
    });

    it('flattens tool results onto their own `tool` messages', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(sseResponse([]));

        await drain(
            provider().stream({
                system: 'You are the copilot.',
                messages: [
                    {
                        role: 'assistant',
                        content: [
                            {
                                type: 'tool_use',
                                id: 'call_1',
                                name: 'search',
                                input: { q: 'x' }
                            }
                        ]
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'tool_result',
                                toolUseId: 'call_1',
                                content: '3 results'
                            }
                        ]
                    }
                ],
                maxOutputTokens: 256
            })
        );

        expect(lastBody().messages).toEqual([
            { role: 'system', content: 'You are the copilot.' },
            {
                role: 'assistant',
                content: '',
                tool_calls: [
                    {
                        id: 'call_1',
                        type: 'function',
                        function: { name: 'search', arguments: '{"q":"x"}' }
                    }
                ]
            },
            { role: 'tool', tool_call_id: 'call_1', content: '3 results' }
        ]);
    });

    it('sends tools in the function-calling shape, and omits the key when there are none', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(sseResponse([]));
        await drain(provider().stream(request));
        expect(lastBody()).not.toHaveProperty('tools');

        jest.mocked(globalThis.fetch).mockResolvedValue(sseResponse([]));
        await drain(
            provider().stream({
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

        expect(lastBody().tools).toEqual([
            {
                type: 'function',
                function: {
                    name: 'content.searchEntries',
                    description: 'Search entries',
                    parameters: { type: 'object' }
                }
            }
        ]);
    });

    it('raises a request error naming the endpoint and status', async () => {
        jest.mocked(globalThis.fetch).mockResolvedValue(
            new Response('model not found', { status: 404 })
        );

        await expect(drain(provider().stream(request))).rejects.toThrow(
            /chat\/completions failed: 404/
        );
    });

    it('ends with `aborted` rather than throwing when the caller cancels', async () => {
        const controller = new AbortController();
        jest.mocked(globalThis.fetch).mockImplementation(() => {
            controller.abort();
            return Promise.reject(
                Object.assign(new Error('aborted'), { name: 'AbortError' })
            );
        });

        const events = await drain(
            provider().stream(request, controller.signal)
        );

        expect(events).toEqual([
            {
                type: 'done',
                stopReason: 'aborted',
                usage: { inputTokens: 0, outputTokens: 0 }
            }
        ]);
    });

    it('reports operator-declared capabilities, so degraded mode is honest', async () => {
        const degraded = createOpenAiCompatibleProvider({
            baseUrl: 'http://localhost:11434/v1',
            model: 'tinyllama',
            capabilities: { toolCalling: false, contextWindow: 2_048 }
        });

        await expect(degraded.capabilities()).resolves.toEqual({
            model: 'tinyllama',
            toolCalling: false,
            streaming: true,
            vision: false,
            contextWindow: 2_048,
            maxOutputTokens: 4_096
        });
    });
});
