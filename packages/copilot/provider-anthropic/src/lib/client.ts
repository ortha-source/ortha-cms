import Anthropic from '@anthropic-ai/sdk';
import type { AnthropicProviderConfig } from './config';

/** Resolves the SDK client, constructing it on first call. */
export type LazyClient = () => Anthropic;

/**
 * Builds a memoized client factory. The SDK client is constructed on **first
 * use**, not up front: a host registers every provider it might route to, but
 * an operator running local inference has no Anthropic key — and an unused
 * adapter must not fail their boot.
 *
 * Selecting the provider without a key then fails at the moment it actually
 * matters, with a message naming the fix.
 */
export function createLazyClient(config: AnthropicProviderConfig): LazyClient {
    let client: Anthropic | undefined;

    return () => {
        if (!client) {
            if (!config.apiKey) {
                throw new Error(
                    'The Anthropic copilot provider was selected but no API key is configured. ' +
                        'Set ANTHROPIC_API_KEY, or pick another provider in the model picker.'
                );
            }
            client = new Anthropic({
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
        return client;
    };
}
