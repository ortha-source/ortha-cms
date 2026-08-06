import type {
    ModelCapabilities,
    ModelMessage,
    ModelProvider,
    ModelRequest,
    ModelStopReason,
    ModelStreamEvent,
    ModelTool,
    ModelUsage
} from '@ortha-cms/copilot-domain';
import { readDataEvents } from './sse';

/** Options for {@link createOpenAiCompatibleProvider}. */
export interface OpenAiCompatibleProviderConfig {
    /**
     * The API root, up to and including the version segment — e.g.
     * `http://localhost:11434/v1` (Ollama) or `https://api.openai.com/v1`.
     * `/chat/completions` is appended.
     */
    baseUrl: string;
    /** Default model id, e.g. `llama3.1`. Overridable per request. */
    model: string;
    /** Bearer token. Omit for a local runtime that wants no auth. */
    apiKey?: string;
    /** Extra headers — an Azure `api-key`, an OpenRouter attribution header. */
    headers?: Readonly<Record<string, string>>;
    /**
     * What this endpoint's model can do. The wire format exposes no capability
     * discovery, so the operator declares it: a 3B model that cannot call
     * tools must say so, or the engine will assume a baseline it cannot meet
     * ([ADR-0004](../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §4).
     */
    capabilities?: Partial<Omit<ModelCapabilities, 'model'>>;
    /** Request timeout in milliseconds. Defaults to 120 000. */
    timeoutMs?: number;
}

const DEFAULT_CAPABILITIES = {
    toolCalling: true,
    streaming: true,
    vision: false,
    contextWindow: 32_768,
    maxOutputTokens: 4_096
} as const;

const DEFAULT_TIMEOUT_MS = 120_000;

/** The subset of the streaming chat-completions chunk this adapter reads. */
interface ChatCompletionChunk {
    choices?: {
        delta?: {
            content?: string | null;
            tool_calls?: {
                index: number;
                id?: string;
                function?: { name?: string; arguments?: string };
            }[];
        };
        finish_reason?: string | null;
    }[];
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
    } | null;
}

/** An in-flight tool call, assembled from `arguments` fragments. */
interface PartialToolCall {
    id?: string;
    name?: string;
    args: string;
}

function toStopReason(
    finishReason: string | null | undefined
): ModelStopReason {
    switch (finishReason) {
        case 'tool_calls':
        case 'function_call':
            return 'tool_use';
        case 'length':
            return 'max_tokens';
        case 'content_filter':
            return 'refusal';
        default:
            return 'end';
    }
}

/** One OpenAI-shaped chat message. */
interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_call_id?: string;
    tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
    }[];
}

/**
 * Flattens the port's block-structured turns into OpenAI's flat message list.
 * One turn can become several messages: tool results ride on their own `tool`
 * messages rather than inside the user turn that carried them.
 */
function toChatMessages(
    messages: readonly ModelMessage[],
    system?: string
): ChatMessage[] {
    const chat: ChatMessage[] = system
        ? [{ role: 'system', content: system }]
        : [];

    for (const message of messages) {
        const text: string[] = [];
        const toolCalls: NonNullable<ChatMessage['tool_calls']> = [];
        const toolResults: ChatMessage[] = [];

        for (const block of message.content) {
            if (block.type === 'text') {
                text.push(block.text);
            } else if (block.type === 'tool_use') {
                toolCalls.push({
                    id: block.id,
                    type: 'function',
                    function: {
                        name: block.name,
                        arguments: JSON.stringify(block.input ?? {})
                    }
                });
            } else {
                toolResults.push({
                    role: 'tool',
                    tool_call_id: block.toolUseId,
                    content: block.content
                });
            }
        }

        if (text.length > 0 || toolCalls.length > 0) {
            chat.push({
                role: message.role,
                content: text.join('\n'),
                ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {})
            });
        }
        // Tool results must follow the assistant turn that requested them.
        chat.push(...toolResults);
    }

    return chat;
}

function toChatTools(tools: readonly ModelTool[]): unknown[] {
    return tools.map((tool) => ({
        type: 'function',
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
        }
    }));
}

/**
 * Parses a tool call's accumulated arguments. A model that emits malformed
 * JSON gets an empty object rather than crashing the run — the engine then
 * fails schema validation and returns a tool error the model can recover from.
 */
function parseArgs(args: string): unknown {
    if (!args.trim()) {
        return {};
    }
    try {
        return JSON.parse(args);
    } catch {
        return {};
    }
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    return error instanceof Error && error.name === 'AbortError';
}

/**
 * Creates the OpenAI-compatible adapter. One configurable `baseUrl` covers
 * Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter, Azure and OpenAI
 * itself — which is what makes a local, air-gapped install a configuration
 * choice rather than a fork
 * ([ADR-0004](../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3).
 *
 * @example
 * ```typescript
 * createOpenAiCompatibleProvider({
 *     baseUrl: 'http://localhost:11434/v1',
 *     model: 'llama3.1',
 *     capabilities: { contextWindow: 8_192 }
 * });
 * ```
 */
export function createOpenAiCompatibleProvider(
    config: OpenAiCompatibleProviderConfig
): ModelProvider {
    const endpoint = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    async function* stream(
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> {
        const tools = request.tools ?? [];
        const timeout = AbortSignal.timeout(timeoutMs);
        const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    ...(config.apiKey
                        ? { authorization: `Bearer ${config.apiKey}` }
                        : {}),
                    ...config.headers
                },
                body: JSON.stringify({
                    model: request.model ?? config.model,
                    messages: toChatMessages(request.messages, request.system),
                    ...(tools.length > 0 ? { tools: toChatTools(tools) } : {}),
                    max_tokens: request.maxOutputTokens,
                    stream: true,
                    // Servers that don't know this field ignore it; the ones
                    // that do return a final usage-only chunk.
                    stream_options: { include_usage: true }
                }),
                signal: combined
            });

            if (!response.ok || !response.body) {
                const detail = response.body
                    ? await response.text().catch(() => '')
                    : '';
                throw new Error(
                    `Copilot model request to ${endpoint} failed: ${response.status} ${response.statusText}` +
                        (detail ? ` — ${detail.slice(0, 500)}` : '')
                );
            }

            const partialCalls = new Map<number, PartialToolCall>();
            let stopReason: ModelStopReason = 'end';
            let usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };

            for await (const payload of readDataEvents(response.body)) {
                let chunk: ChatCompletionChunk;
                try {
                    chunk = JSON.parse(payload) as ChatCompletionChunk;
                } catch {
                    // A keep-alive or a non-JSON comment line: not our problem.
                    continue;
                }

                if (chunk.usage) {
                    const cached =
                        chunk.usage.prompt_tokens_details?.cached_tokens;
                    usage = {
                        inputTokens: chunk.usage.prompt_tokens ?? 0,
                        outputTokens: chunk.usage.completion_tokens ?? 0,
                        ...(cached === undefined
                            ? {}
                            : { cachedInputTokens: cached })
                    };
                }

                const choice = chunk.choices?.[0];
                if (!choice) {
                    continue;
                }

                if (choice.delta?.content) {
                    yield { type: 'text-delta', text: choice.delta.content };
                }

                for (const call of choice.delta?.tool_calls ?? []) {
                    const existing = partialCalls.get(call.index) ?? {
                        args: ''
                    };
                    partialCalls.set(call.index, {
                        id: call.id ?? existing.id,
                        name: call.function?.name ?? existing.name,
                        args: existing.args + (call.function?.arguments ?? '')
                    });
                }

                if (choice.finish_reason) {
                    stopReason = toStopReason(choice.finish_reason);
                }
            }

            // Emitted only once the stream is complete, so a call is delivered
            // whole and already parsed rather than as argument fragments.
            for (const [index, call] of [...partialCalls].sort(
                ([left], [right]) => left - right
            )) {
                if (!call.name) {
                    continue;
                }
                yield {
                    type: 'tool-call',
                    id: call.id ?? `call-${index}`,
                    name: call.name,
                    input: parseArgs(call.args)
                };
            }

            yield { type: 'done', stopReason, usage };
        } catch (error) {
            if (isAbort(error, signal)) {
                yield {
                    type: 'done',
                    stopReason: 'aborted',
                    usage: { inputTokens: 0, outputTokens: 0 }
                };
                return;
            }
            if (timeout.aborted) {
                throw new Error(
                    `Copilot model request to ${endpoint} timed out after ${timeoutMs}ms.`
                );
            }
            throw error;
        }
    }

    return {
        capabilities(): Promise<ModelCapabilities> {
            return Promise.resolve({
                model: config.model,
                ...DEFAULT_CAPABILITIES,
                ...config.capabilities
            });
        },
        stream
    };
}
