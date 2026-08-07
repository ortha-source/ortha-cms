import type { ModelCapabilities } from '@ortha-cms/copilot-domain';

/** Options for `createOpenAiCompatibleProvider`. */
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

/** Optimistic defaults — the frontier-model case, overridden per deployment. */
export const DEFAULT_CAPABILITIES = {
    toolCalling: true,
    streaming: true,
    vision: false,
    contextWindow: 32_768,
    maxOutputTokens: 4_096
} as const;

export const DEFAULT_TIMEOUT_MS = 120_000;

/** Appends the chat-completions path, tolerating a trailing slash on the root. */
export function resolveEndpoint(baseUrl: string): string {
    return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

/** Merges the operator's declared capabilities over the defaults. */
export function resolveCapabilities(
    config: OpenAiCompatibleProviderConfig
): ModelCapabilities {
    return {
        model: config.model,
        ...DEFAULT_CAPABILITIES,
        ...config.capabilities
    };
}
