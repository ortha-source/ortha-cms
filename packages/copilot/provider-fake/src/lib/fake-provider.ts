import type {
    ModelCapabilities,
    ModelProvider,
    ModelRequest,
    ModelStopReason,
    ModelStreamEvent,
    ModelUsage
} from '@ortha-cms/copilot-domain';

/** One scripted assistant turn: some prose, some tool calls, or both. */
export interface FakeTurn {
    /** Prose to stream, split into deltas of {@link FakeProviderConfig.chunkSize}. */
    text?: string;
    /**
     * Tool calls to emit after the text. Supplying any implies a
     * `tool_use` stop reason unless {@link stopReason} says otherwise.
     */
    toolCalls?: readonly FakeToolCall[];
    /** Overrides the inferred stop reason. */
    stopReason?: ModelStopReason;
    /** Overrides the derived token counts. */
    usage?: ModelUsage;
}

/** A tool call the script asks the fake model to "decide" to make. */
export interface FakeToolCall {
    /** Defaults to a deterministic `fake-tool-<turn>-<index>`. */
    id?: string;
    /** The tool name, which must be one the run actually offered. */
    name: string;
    /** Arguments handed to the tool, already parsed. */
    input: unknown;
}

/** Options for {@link createFakeProvider}. */
export interface FakeProviderConfig {
    /**
     * Turns to play back, one per model call, in order. **Omit for dev mode**:
     * every call then returns the same canned reply, so a contributor can run
     * the admin without a key. Supplied, the script is a test fixture and
     * running past its end throws rather than inventing an answer.
     */
    script?: readonly FakeTurn[];
    /** Overrides the reported capabilities — e.g. to exercise degraded mode. */
    capabilities?: Partial<ModelCapabilities>;
    /** Characters per `text-delta`. Defaults to 8, so assembly is exercised. */
    chunkSize?: number;
}

/**
 * The fake provider, plus the inspection surface tests need. `calls` is the
 * assertion target for "a viewer's run was never offered a write tool" — the
 * negative case ADR-0005 makes mandatory.
 */
export interface FakeProvider extends ModelProvider {
    /** Every request served so far, in order. */
    readonly calls: readonly ModelRequest[];
    /** Clears {@link calls} and rewinds the script — call between tests. */
    reset(): void;
}

/** The canned dev-mode reply used when no script is supplied. */
const DEV_MODE_REPLY =
    'The fake copilot provider is active, so no model was called. ' +
    'Point `plugins.copilot.defaultProvider` at a real provider to get a real answer.';

const DEFAULT_CAPABILITIES: ModelCapabilities = {
    model: 'fake',
    toolCalling: true,
    streaming: true,
    vision: false,
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000
};

/**
 * Rough, deterministic token estimate. Not a tokenizer — the point is that
 * usage accounting has stable non-zero numbers to assert against.
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Every character the request would put in front of the model. */
function requestText(request: ModelRequest): string {
    const parts: string[] = [request.system ?? ''];
    for (const message of request.messages) {
        for (const block of message.content) {
            if (block.type === 'text') {
                parts.push(block.text);
            } else if (block.type === 'tool_result') {
                parts.push(block.content);
            } else {
                parts.push(block.name, JSON.stringify(block.input));
            }
        }
    }
    for (const tool of request.tools ?? []) {
        parts.push(tool.name, tool.description);
    }
    return parts.join('');
}

function chunk(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let index = 0; index < text.length; index += size) {
        chunks.push(text.slice(index, index + size));
    }
    return chunks;
}

/**
 * Creates the scripted, deterministic provider. **Shipped, not test
 * scaffolding** ([ADR-0004](../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §3):
 * it is how `server-e2e` drives the whole tool loop with no API key and no
 * network, and how a contributor runs the admin offline.
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
    const chunkSize = Math.max(1, config.chunkSize ?? 8);
    const capabilities: ModelCapabilities = {
        ...DEFAULT_CAPABILITIES,
        ...config.capabilities
    };
    const calls: ModelRequest[] = [];
    let turnIndex = 0;

    function nextTurn(): FakeTurn {
        // No script: dev mode, so the same canned reply every time.
        if (!config.script) {
            return { text: DEV_MODE_REPLY };
        }
        const turn = config.script[turnIndex];
        if (!turn) {
            throw new Error(
                `Fake copilot provider script exhausted: ${config.script.length} turn(s) scripted, ` +
                    `call ${turnIndex + 1} requested. Add a turn, or assert fewer model calls.`
            );
        }
        turnIndex += 1;
        return turn;
    }

    async function* stream(
        request: ModelRequest,
        signal?: AbortSignal
    ): AsyncIterable<ModelStreamEvent> {
        const callIndex = calls.push(request) - 1;
        // Read the turn before checking the signal so an aborted call still
        // advances the script — the run happened, it just didn't finish.
        const turn = nextTurn();

        if (signal?.aborted) {
            yield {
                type: 'done',
                stopReason: 'aborted',
                usage: { inputTokens: 0, outputTokens: 0 }
            };
            return;
        }

        const text = turn.text ?? '';
        for (const piece of chunk(text, chunkSize)) {
            if (signal?.aborted) {
                yield {
                    type: 'done',
                    stopReason: 'aborted',
                    usage: {
                        inputTokens: estimateTokens(requestText(request)),
                        outputTokens: estimateTokens(text)
                    }
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
            usage: turn.usage ?? {
                inputTokens: estimateTokens(requestText(request)),
                outputTokens: estimateTokens(text)
            }
        };
    }

    return {
        calls,
        reset(): void {
            calls.length = 0;
            turnIndex = 0;
        },
        capabilities(): Promise<ModelCapabilities> {
            return Promise.resolve(capabilities);
        },
        stream
    };
}
