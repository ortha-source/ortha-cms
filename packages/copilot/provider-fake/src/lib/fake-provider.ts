import {
    abortedEvent,
    type ModelCapabilities,
    type ModelRequest,
    type ModelStreamEvent
} from '@ortha-cms/copilot-domain';
import {
    DEFAULT_CAPABILITIES,
    DEFAULT_CHUNK_SIZE,
    type FakeProvider,
    type FakeProviderConfig
} from './config';
import { createScriptReader } from './script';
import { chunkText } from './text';
import { estimateUsage } from './usage';

/**
 * Creates the scripted, deterministic provider. **Shipped, not test
 * scaffolding** ([ADR-0004](../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3):
 * it is how `server-e2e` drives the whole tool loop with no API key and no
 * network, and how a contributor runs the admin offline.
 *
 * No network, no clock, no randomness — the run engine is a non-deterministic
 * multi-step loop, and a flaky fake would make every assertion downstream of
 * it flaky too.
 *
 * @example
 * ```typescript
 * const provider = createFakeProvider({
 *     script: [
 *         { toolCalls: [{ name: 'content.searchEntries', input: { q: 'launch' } }] },
 *         { text: 'I found 3 matching articles.' }
 *     ]
 * });
 * ```
 */
export function createFakeProvider(
    config: FakeProviderConfig = {}
): FakeProvider {
    const chunkSize = Math.max(1, config.chunkSize ?? DEFAULT_CHUNK_SIZE);
    const capabilities: ModelCapabilities = {
        ...DEFAULT_CAPABILITIES,
        ...config.capabilities
    };
    const script = createScriptReader(config.script);
    const calls: ModelRequest[] = [];

    async function* stream(
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> {
        const callIndex = calls.push(request) - 1;
        // Read the turn before checking the signal so an aborted call still
        // advances the script — the run happened, it just didn't finish.
        const turn = script.next();

        if (signal?.aborted) {
            yield abortedEvent();
            return;
        }

        const text = turn.text ?? '';
        for (const piece of chunkText(text, chunkSize)) {
            if (signal?.aborted) {
                yield {
                    type: 'done',
                    stopReason: 'aborted',
                    // Unlike a pre-flight abort, tokens were "produced" here,
                    // so the partial usage is the honest number to report.
                    usage: estimateUsage(request, text)
                };
                return;
            }
            yield { type: 'text-delta', text: piece };
        }

        const toolCalls = turn.toolCalls ?? [];
        for (const [index, call] of toolCalls.entries()) {
            yield {
                type: 'tool-call',
                id: call.id ?? `fake-tool-${callIndex}-${index}`,
                name: call.name,
                input: call.input
            };
        }

        yield {
            type: 'done',
            stopReason:
                turn.stopReason ?? (toolCalls.length > 0 ? 'tool_use' : 'end'),
            usage: turn.usage ?? estimateUsage(request, text)
        };
    }

    return {
        calls,
        reset(): void {
            calls.length = 0;
            script.reset();
        },
        capabilities(): Promise<ModelCapabilities> {
            return Promise.resolve(capabilities);
        },
        stream
    };
}
