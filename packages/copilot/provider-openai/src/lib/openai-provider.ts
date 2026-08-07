import {
    abortedEvent,
    isAbortError,
    resolveModel,
    type ModelCapabilities,
    type ModelProvider,
    type ModelRequest,
    type ModelStopReason,
    type ModelStreamEvent,
    type ModelUsage
} from '@ortha-cms/copilot-domain';
import {
    DEFAULT_TIMEOUT_MS,
    resolveCapabilities,
    resolveEndpoint,
    type OpenAiProviderConfig
} from './config';
import { readDataEvents } from './sse';
import { toRequestBody, toRequestHeaders } from './wire/request';
import { toStopReason, toUsage } from './wire/response';
import { createToolCallAccumulator } from './wire/tool-call-accumulator';
import type { ChatCompletionChunk } from './wire/types';

/**
 * Creates the OpenAI-compatible adapter. One configurable `baseUrl` covers
 * Ollama, vLLM, llama.cpp, LM Studio, LiteLLM, OpenRouter, Azure and OpenAI
 * itself — which is what makes a local, air-gapped install a configuration
 * choice rather than a fork
 * ([ADR-0004](../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3).
 *
 * This file holds only the request/stream orchestration. The pieces worth
 * reading on their own live beside it — `sse.ts` (event-stream parsing),
 * `wire/request.ts` and `wire/response.ts` (the two mapping directions), and
 * `wire/tool-call-accumulator.ts` (fragment assembly).
 *
 * @example
 * ```typescript
 * createOpenAiProvider({
 *     baseUrl: 'http://localhost:11434/v1',
 *     model: 'llama3.1',
 *     capabilities: { contextWindow: 8_192 }
 * });
 * ```
 */
export function createOpenAiProvider(
    config: OpenAiProviderConfig
): ModelProvider {
    const endpoint = resolveEndpoint(config.baseUrl);
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const models = [...config.models];

    async function* stream(
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> {
        // Resolved before the request is built, so a run naming a model this
        // endpoint doesn't serve fails loudly instead of silently answering
        // on the default one.
        const model = resolveModel(request.model, models);
        const timeout = AbortSignal.timeout(timeoutMs);
        const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: toRequestHeaders(config),
                body: JSON.stringify(toRequestBody(request, config, model)),
                signal: combined
            });

            if (!response.ok || !response.body) {
                throw await requestError(response);
            }

            const toolCalls = createToolCallAccumulator();
            let stopReason: ModelStopReason = 'end';
            let usage: ModelUsage = { inputTokens: 0, outputTokens: 0 };

            for await (const payload of readDataEvents(response.body)) {
                const chunk = parseChunk(payload);
                if (!chunk) {
                    continue;
                }

                if (chunk.usage) {
                    usage = toUsage(chunk.usage);
                }

                const choice = chunk.choices?.[0];
                if (!choice) {
                    continue;
                }
                if (choice.delta?.content) {
                    yield { type: 'text-delta', text: choice.delta.content };
                }
                toolCalls.add(choice.delta?.tool_calls ?? []);
                if (choice.finish_reason) {
                    stopReason = toStopReason(choice.finish_reason);
                }
            }

            yield* toolCalls.drain();
            yield { type: 'done', stopReason, usage };
        } catch (error) {
            if (isAbortError(error, signal)) {
                yield abortedEvent();
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

    /** Builds the error for a non-2xx response, including any body detail. */
    async function requestError(response: Response): Promise<Error> {
        const detail = response.body
            ? await response.text().catch(() => '')
            : '';
        return new Error(
            `Copilot model request to ${endpoint} failed: ${response.status} ${response.statusText}` +
                (detail ? ` — ${detail.slice(0, 500)}` : '')
        );
    }

    return {
        models: () => models,
        capabilities(model?: string): Promise<ModelCapabilities> {
            return Promise.resolve(
                resolveCapabilities(config, resolveModel(model, models))
            );
        },
        stream
    };
}

/** A keep-alive or non-JSON comment line is not our problem — skip it. */
function parseChunk(payload: string): ChatCompletionChunk | undefined {
    try {
        return JSON.parse(payload) as ChatCompletionChunk;
    } catch {
        return undefined;
    }
}
