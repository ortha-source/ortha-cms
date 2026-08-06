import Anthropic from '@anthropic-ai/sdk';
import type {
    MessageParam,
    StopReason,
    Tool,
    Usage
} from '@anthropic-ai/sdk/resources/messages';
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

/**
 * How much of the model's reasoning budget a run may spend. Higher settings
 * trade tokens and latency for depth; `high` is the API default.
 */
export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Options for {@link createAnthropicProvider}. */
export interface AnthropicProviderConfig {
    /** API key. Never leaves the server, and never reaches the browser. */
    apiKey: string;
    /** Default model id, e.g. `claude-opus-5`. Overridable per request. */
    model: string;
    /** Overrides the API host — a gateway, a proxy, or a regional endpoint. */
    baseUrl?: string;
    /** Reasoning-budget setting. Omitted, the API's own default (`high`) applies. */
    effort?: AnthropicEffort;
    /** Retries on 429/5xx/connection errors. Defaults to the SDK's 2. */
    maxRetries?: number;
    /** Per-request timeout in milliseconds. Defaults to the SDK's 10 minutes. */
    timeoutMs?: number;
}

/**
 * Fallback capabilities, used when the Models API can't be reached (no
 * network, no key, a gateway that doesn't proxy `/v1/models`). Conservative on
 * the two numbers and honest on the three flags: every current Claude model
 * streams, calls tools natively, and accepts images.
 */
const FALLBACK_CAPABILITIES = {
    toolCalling: true,
    streaming: true,
    vision: true,
    contextWindow: 200_000,
    maxOutputTokens: 8_192
} as const;

/** Maps Anthropic's stop reasons onto the port's smaller vocabulary. */
function toStopReason(stopReason: StopReason | null): ModelStopReason {
    switch (stopReason) {
        case 'tool_use':
            return 'tool_use';
        case 'refusal':
            return 'refusal';
        case 'max_tokens':
        case 'model_context_window_exceeded':
            // Both mean "ran out of room" — the answer is truncated either way.
            return 'max_tokens';
        default:
            // `end_turn`, `stop_sequence`, `pause_turn` (unreachable without
            // server-side tools, which this adapter never enables), and null.
            return 'end';
    }
}

function toUsage(usage: Usage): ModelUsage {
    const cached = usage.cache_read_input_tokens;
    return {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        ...(cached === null || cached === undefined
            ? {}
            : { cachedInputTokens: cached })
    };
}

function toAnthropicTools(tools: readonly ModelTool[]): Tool[] {
    return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema as Tool.InputSchema
    }));
}

function toAnthropicMessages(
    messages: readonly ModelMessage[]
): MessageParam[] {
    return messages.map((message) => ({
        role: message.role,
        content: message.content.map((block) => {
            switch (block.type) {
                case 'text':
                    return { type: 'text' as const, text: block.text };
                case 'tool_use':
                    return {
                        type: 'tool_use' as const,
                        id: block.id,
                        name: block.name,
                        input: block.input
                    };
                case 'tool_result':
                    return {
                        type: 'tool_result' as const,
                        tool_use_id: block.toolUseId,
                        content: block.content,
                        ...(block.isError ? { is_error: true } : {})
                    };
            }
        })
    }));
}

/** Whether a thrown error is the abort we asked for rather than a real failure. */
function isAbort(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    return error instanceof Error && error.name === 'AbortError';
}

/**
 * Creates the native Claude adapter — the default for tool-heavy work, and the
 * path on which native capabilities stay available
 * ([ADR-0004](../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3).
 *
 * The SDK client is constructed **lazily**, on first use. A host registers
 * every provider it might route to, but an operator running local inference
 * has no Anthropic key — and an unused adapter must not fail their boot.
 *
 * @example
 * ```typescript
 * CopilotPlugin({
 *     providers: {
 *         anthropic: createAnthropicProvider(config.plugins.copilot.anthropic)
 *     },
 *     config: config.plugins.copilot
 * });
 * ```
 */
export function createAnthropicProvider(
    config: AnthropicProviderConfig
): ModelProvider {
    let cachedClient: Anthropic | undefined;
    let cachedCapabilities: Promise<ModelCapabilities> | undefined;

    function client(): Anthropic {
        if (!cachedClient) {
            if (!config.apiKey) {
                throw new Error(
                    'The Anthropic copilot provider was selected but no API key is configured. ' +
                        'Set ANTHROPIC_API_KEY, or point plugins.copilot.defaultProvider at another provider.'
                );
            }
            cachedClient = new Anthropic({
                apiKey: config.apiKey,
                ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
                ...(config.maxRetries === undefined
                    ? {}
                    : { maxRetries: config.maxRetries }),
                ...(config.timeoutMs === undefined
                    ? {}
                    : { timeout: config.timeoutMs })
            });
        }
        return cachedClient;
    }

    /**
     * Probes the Models API for the live capability record, falling back to
     * {@link FALLBACK_CAPABILITIES} when it can't be reached — reporting
     * "unknown" as "unsupported" would put a frontier model into degraded mode
     * over a transient network blip.
     */
    async function probe(): Promise<ModelCapabilities> {
        const base = { model: config.model, ...FALLBACK_CAPABILITIES };
        try {
            const info = await client().models.retrieve(config.model);
            return {
                model: info.id,
                // The Models API reports no tool-calling flag; every model it
                // serves supports it.
                toolCalling: true,
                streaming: true,
                vision: info.capabilities?.image_input.supported ?? base.vision,
                contextWindow: info.max_input_tokens ?? base.contextWindow,
                maxOutputTokens: info.max_tokens ?? base.maxOutputTokens
            };
        } catch {
            return base;
        }
    }

    async function* stream(
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> {
        const tools = request.tools ?? [];

        // Opening the stream lives inside the try alongside iterating it: an
        // already-aborted signal makes the SDK reject at construction, and
        // that is still an abort rather than a failure the caller should see.
        try {
            // Thinking is left at the API default (on, adaptive). Disabling it
            // on current models makes them occasionally write a tool call into
            // the visible text instead of emitting a tool-use block — the call
            // then silently never runs, which for a tool-driven copilot is the
            // worst possible failure mode.
            const messageStream = client().messages.stream(
                {
                    model: request.model ?? config.model,
                    max_tokens: request.maxOutputTokens,
                    ...(request.system ? { system: request.system } : {}),
                    messages: toAnthropicMessages(request.messages),
                    ...(tools.length > 0
                        ? { tools: toAnthropicTools(tools) }
                        : {}),
                    ...(config.effort
                        ? { output_config: { effort: config.effort } }
                        : {})
                },
                signal ? { signal } : undefined
            );

            for await (const event of messageStream) {
                if (
                    event.type === 'content_block_delta' &&
                    event.delta.type === 'text_delta'
                ) {
                    yield { type: 'text-delta', text: event.delta.text };
                }
            }

            // Tool calls come from the assembled message rather than from
            // `input_json_delta` fragments, so a call is emitted once, whole,
            // and already parsed — the engine never sees half a call.
            const message = await messageStream.finalMessage();
            for (const block of message.content) {
                if (block.type === 'tool_use') {
                    yield {
                        type: 'tool-call',
                        id: block.id,
                        name: block.name,
                        input: block.input
                    };
                }
            }

            yield {
                type: 'done',
                stopReason: toStopReason(message.stop_reason),
                usage: toUsage(message.usage)
            };
        } catch (error) {
            if (isAbort(error, signal)) {
                yield {
                    type: 'done',
                    stopReason: 'aborted',
                    // A cancelled call reports no usage: the partial response
                    // never reaches a usage record we can trust.
                    usage: { inputTokens: 0, outputTokens: 0 }
                };
                return;
            }
            throw error;
        }
    }

    return {
        capabilities(): Promise<ModelCapabilities> {
            cachedCapabilities ??= probe();
            return cachedCapabilities;
        },
        stream
    };
}
