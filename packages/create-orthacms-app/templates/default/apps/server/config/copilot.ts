/** The copilot kill switch and the model backends it can reach. */
import type { CopilotPluginConfig } from '@orthacms/copilot-server';
// orthacms:if copilot-anthropic
import type { AnthropicProviderConfig } from '@orthacms/copilot-provider-anthropic';
// orthacms:end
// orthacms:if copilot-openai
import type { OpenAiProviderConfig } from '@orthacms/copilot-provider-openai';
// orthacms:end
import { copilotEnabled, copilotQuotasFromEnv } from '@orthacms/config';
import { defined } from '@orthacms/utils-server';

// orthacms:if copilot-anthropic
import { anthropicProvider } from './copilot-anthropic';
// orthacms:end
// orthacms:if copilot-openai
import { openAiProvider } from './copilot-openai';
// orthacms:end

/**
 * Copilot settings plus the backends this deployment can reach.
 *
 * The provider settings live **here**, not inside `CopilotPluginConfig`: the
 * plugin is adapter-agnostic by decision, so it names no provider kind. A key
 * is present only when the deployment configured that backend, and `plugins.ts`
 * registers exactly the ones that are — "configured" is a fact this file can
 * read, where a `defaultProvider` naming one of them could be misspelled or
 * point at a backend nobody registered.
 */
export interface AppCopilotConfig extends CopilotPluginConfig {
    providers: {
        // orthacms:if copilot-anthropic
        /** Native Claude. Present when ANTHROPIC_API_KEY is set. */
        claude?: AnthropicProviderConfig;
        // orthacms:end
        // orthacms:if copilot-openai
        /**
         * An OpenAI-wire endpoint — Ollama, vLLM, LiteLLM, Azure or OpenAI.
         * Present when COPILOT_OPENAI_BASE_URL is set: an endpoint nobody
         * named is a backend that can only time out.
         */
        openai?: OpenAiProviderConfig;
        // orthacms:end
    };
}

/** The copilot kill switch and the model backends it can reach. */
export function copilotConfig(): AppCopilotConfig {
    return defined({
        // Off by default: enabling a hosted provider sends workspace content to
        // a third party, which is an operator's decision to make explicitly.
        enabled: copilotEnabled(),
        // Ceiling on a single model response, in tokens. The run ceilings
        // (steps, wall clock, total tokens) are the plugin's defaults; raise
        // them together here with `limits: { … }` if answers come back
        // incomplete.
        maxOutputTokens: 8192,
        // Daily token and rate limits, each off unless its variable is set.
        quotas: copilotQuotasFromEnv(),
        providers: defined({
            // orthacms:if copilot-anthropic
            claude: anthropicProvider(),
            // orthacms:end
            // orthacms:if copilot-openai
            openai: openAiProvider()
            // orthacms:end
        })
    });
}
