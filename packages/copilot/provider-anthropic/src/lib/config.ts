/**
 * How much of the model's reasoning budget a run may spend. Higher settings
 * trade tokens and latency for depth; `high` is the API default.
 */
export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Options for `createAnthropicProvider`. */
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
export const FALLBACK_CAPABILITIES = {
    toolCalling: true,
    streaming: true,
    vision: true,
    contextWindow: 200_000,
    maxOutputTokens: 8_192
} as const;
