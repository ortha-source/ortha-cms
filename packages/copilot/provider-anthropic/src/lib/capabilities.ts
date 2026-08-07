import type { ModelCapabilities } from '@ortha-cms/copilot-domain';
import type { LazyClient } from './client';
import { FALLBACK_CAPABILITIES, type AnthropicProviderConfig } from './config';

/**
 * Probes the Models API for the live capability record.
 *
 * Falls back to {@link FALLBACK_CAPABILITIES} when the call can't be made —
 * reporting "unknown" as "unsupported" would drop a frontier model into
 * degraded mode over a transient network blip, which is a worse failure than
 * being slightly optimistic about a model we know the shape of.
 *
 * The Models API exposes no tool-calling flag; every model it serves supports
 * tool calling, so that stays `true` on both paths.
 */
export async function probeCapabilities(
    client: LazyClient,
    config: AnthropicProviderConfig
): Promise<ModelCapabilities> {
    const base = { model: config.model, ...FALLBACK_CAPABILITIES };
    try {
        const info = await client().models.retrieve(config.model);
        return {
            model: info.id,
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
