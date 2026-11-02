// orthacms:if copilot-anthropic
import type { AnthropicProviderConfig } from '@orthacms/copilot-provider-anthropic';
import { anthropicFromEnv } from '@orthacms/config';

/**
 * Claude, or nothing. `ANTHROPIC_API_KEY` is what registers it — leave it
 * empty and there is no `claude` in the model picker at all, rather than one
 * that fails on the first message. `COPILOT_ANTHROPIC_MODELS` lists what
 * people may pick; the first is the default.
 */
export function anthropicProvider(): AnthropicProviderConfig | undefined {
    return anthropicFromEnv();
}
// orthacms:end
