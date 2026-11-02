/** The copilot — its kill switch, its run ceilings, its usage limits, and its model backends. */
import type { CopilotPluginConfig } from '@orthacms/copilot-server';
import type { AnthropicProviderConfig } from '@orthacms/copilot-provider-anthropic';
import type { OpenAiProviderConfig } from '@orthacms/copilot-provider-openai';

import {
    anthropicFromEnv,
    copilotEnabled,
    copilotQuotasFromEnv,
    openAiFromEnv
} from '@orthacms/config';
import { defined } from '@orthacms/utils-server';

/**
 * Copilot settings, plus the connection settings for the model backends this
 * deployment can reach.
 *
 * The provider settings live **here**, not in `CopilotPluginConfig`: the
 * plugin is adapter-agnostic by decision (ADR-0004 §2), so it names no
 * provider kind. This file already imports the adapter factories in
 * `plugins.ts`, so importing their config types costs no new coupling — and
 * adding a fourth backend is a key here plus a line there, with nothing to
 * change inside the copilot packages.
 *
 * Each key is the name runs refer to the provider by. Register two of the same
 * kind freely (`ollamaFast`, `ollamaBig`); each declares its own model list.
 *
 * **A key is present only when the deployment configured that backend**, and
 * `plugins.ts` registers exactly the ones that are. There is no
 * `defaultProvider` naming one of them: the registered list *is* the setting,
 * its first entry serves a run that names none, and the admin's picker opens on
 * it. A name in a variable could be misspelled, could point at a backend nobody
 * registered, and had to be kept in step with the list on every change — while
 * "configured" is a fact this file can read directly.
 */
export interface OrthaCmsCopilotConfig extends CopilotPluginConfig {
    /**
     * Model backends, keyed by the name they are registered under, in
     * preference order. Each is absent unless its connection settings are
     * present — a keyless clone gets neither, and therefore no copilot at all.
     * There is no scripted fallback: `plugins.ts` registers exactly what is
     * configured here, so `COPILOT_ENABLED=true` with nothing configured fails
     * at boot rather than answering every question with a canned sentence.
     */
    providers: {
        /** Native Claude. Present when `ANTHROPIC_API_KEY` is set. */
        claude?: AnthropicProviderConfig;
        /**
         * An OpenAI-wire-format endpoint — a local Ollama, vLLM, LiteLLM,
         * Azure or OpenAI itself. Present when `COPILOT_OPENAI_BASE_URL` is
         * set: an endpoint nobody named is a backend that can only time out,
         * and offering it in the picker would be worse than not having it.
         */
        ollama?: OpenAiProviderConfig;
    };
}

/** The copilot kill switch, its run ceilings, and the backends it can reach. */
export function copilotConfig(): OrthaCmsCopilotConfig {
    return defined({
        enabled: copilotEnabled(),
        // Ceiling on a single model response, in tokens.
        maxOutputTokens: 8_192,
        // The run ceilings — code, not environment. A run over any of them
        // stops with a reason the chat shows; raise them together, because
        // they are checked in one loop and lifting one alone moves the wall.
        // Unset, the plugin's own defaults (30 steps, 5 minutes, 400k tokens)
        // apply:
        //   limits: { maxSteps: 60, wallClockMs: 600_000, maxTotalTokens: 800_000 },
        // Usage limits, each off when unset; they live in Postgres, so they
        // hold across instances.
        quotas: copilotQuotasFromEnv(),
        providers: defined({
            // Order is preference: the first registered backend serves a run
            // that names none and is what the model picker opens on.
            claude: anthropicFromEnv(),
            ollama: openAiFromEnv()
        })
    });
}
