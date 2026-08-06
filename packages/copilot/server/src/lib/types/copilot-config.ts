import type { AnthropicProviderConfig } from '@ortha-cms/copilot-provider-anthropic';
import type { OpenAiCompatibleProviderConfig } from '@ortha-cms/copilot-provider-openai-compatible';

/**
 * The copilot plugin's host-supplied config. Provider **connection** settings
 * live here; the routing handler, if any, is code in the composition root
 * rather than config — the same split as media storage.
 */
export interface CopilotPluginConfig {
    /**
     * The global kill switch. **Off by default**
     * ([ADR-0005](../../../../../docs/adr/0005-copilot-authority-model.md) §10):
     * enabling a hosted provider sends workspace content to a third party, and
     * that is an operator's decision to make explicitly.
     */
    enabled: boolean;
    /** Provider the core uses when the host supplies no `resolve` handler. */
    defaultProvider: string;
    /** Ceiling on a single model response, in tokens. */
    maxOutputTokens: number;
    /** Native Claude connection settings. */
    anthropic: AnthropicProviderConfig;
    /** OpenAI-wire-format connection settings — Ollama, vLLM, LiteLLM, Azure… */
    openaiCompatible: OpenAiCompatibleProviderConfig;
}
