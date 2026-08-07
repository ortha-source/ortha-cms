/**
 * What a configured model can actually do. Providers report this so the engine
 * can degrade **explicitly** rather than assume
 * ([ADR-0004](../../../../../docs/adr/0004-model-agnostic-copilot-provider.md) §4):
 * a 3B model on a laptop may not support tool calling at all, and pretending
 * otherwise is how the feature earns a bad reputation.
 */
export interface ModelCapabilities {
    /** The model id these capabilities describe. */
    model: string;
    /** Native tool calling. Without it the engine runs the constrained protocol. */
    toolCalling: boolean;
    /** Incremental token delivery. Without it the UI shows one late answer. */
    streaming: boolean;
    /** Image input. Unused in v1; reported so the UI can say so. */
    vision: boolean;
    /** Total context window in tokens. */
    contextWindow: number;
    /** Largest response the provider will produce, in tokens. */
    maxOutputTokens: number;
}

/**
 * The **supported baseline** — streaming, native tool calling, and a context
 * window large enough to hold a workspace's content-type summaries alongside a
 * conversation. Anything below this runs degraded, and the UI says so in words.
 */
export const SUPPORTED_BASELINE = {
    toolCalling: true,
    streaming: true,
    contextWindow: 32_000
} as const;

/** A single way a model falls short of {@link SUPPORTED_BASELINE}. */
export type BaselineShortfall = 'tool-calling' | 'streaming' | 'context-window';

/**
 * Lists every way `capabilities` falls short of {@link SUPPORTED_BASELINE}.
 * An empty array means the model is fully supported; the engine and the
 * settings UI both read this rather than re-deriving the comparison.
 */
export function baselineShortfalls(
    capabilities: ModelCapabilities
): BaselineShortfall[] {
    const shortfalls: BaselineShortfall[] = [];
    if (!capabilities.toolCalling) {
        shortfalls.push('tool-calling');
    }
    if (!capabilities.streaming) {
        shortfalls.push('streaming');
    }
    if (capabilities.contextWindow < SUPPORTED_BASELINE.contextWindow) {
        shortfalls.push('context-window');
    }
    return shortfalls;
}

/** Whether a model clears the supported baseline in every dimension. */
export function meetsSupportedBaseline(
    capabilities: ModelCapabilities
): boolean {
    return baselineShortfalls(capabilities).length === 0;
}
