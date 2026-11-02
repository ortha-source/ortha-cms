// orthacms:if copilot-openai
import type { OpenAiProviderConfig } from '@orthacms/copilot-provider-openai';
import { openAiFromEnv } from '@orthacms/config';

/**
 * An OpenAI-compatible endpoint, or nothing. `COPILOT_OPENAI_BASE_URL` is what
 * registers it, and there is no default: an endpoint nobody named is a backend
 * that can only time out. A local Ollama is http://localhost:11434/v1.
 */
export function openAiProvider(): OpenAiProviderConfig | undefined {
    return openAiFromEnv();
}
// orthacms:end
