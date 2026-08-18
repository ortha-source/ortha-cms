/**
 * How much of the model's reasoning budget a run may spend. Higher settings
 * trade tokens and latency for depth; `high` is the API default.
 */
export type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Options for `createAnthropicProvider`. */
export interface AnthropicProviderConfig {
    /** API key. Never leaves the server, and never reaches the browser. */
    apiKey: string;
    /**
     * Model ids this provider offers, in preference order; the first is the
     * default. Declaring several — a frontier model for hard work, a cheaper
     * one for routine turns — lets a user switch mid-conversation without a
     * redeploy.
     */
    models: readonly string[];
    /** Overrides the API host — a gateway, a proxy, or a regional endpoint. */
    baseUrl?: string;
    /** Reasoning-budget setting. Omitted, the API's own default (`high`) applies. */
    effort?: AnthropicEffort;
    /** Retries on 429/5xx/connection errors. Defaults to the SDK's 2. */
    maxRetries?: number;
    /** Per-request timeout in milliseconds. Defaults to the SDK's 10 minutes. */
    timeoutMs?: number;
    /**
     * Whether to send `cache_control` breakpoints. **Defaults to on**, and
     * should stay on: a run is a loop over a stateless API, so every step
     * resends the whole conversation and an uncached run's billed input grows
     * roughly with the square of its step count. Cache reads are ~0.1x base
     * input price, and the write premium (1.25x) is repaid by the second step.
     *
     * The escape hatch exists for a {@link baseUrl} gateway or proxy that
     * rejects the field rather than passing it through — the symptom is a 400
     * on every run, not a quiet loss of caching.
     */
    promptCaching?: boolean;
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
