import {
    defined,
    readEnv,
    readFlag,
    readList,
    readOptionalPositiveInt
} from '@orthacms/utils-server';

/** Whether the copilot is offered at all (`COPILOT_ENABLED`, default off). */
export function copilotEnabled(): boolean {
    return readFlag('COPILOT_ENABLED', false);
}

/** `@orthacms/copilot-provider-anthropic`'s settings. */
export interface AnthropicSettings {
    apiKey: string;
    models: string[];
    baseUrl?: string;
}

/**
 * Claude, or `undefined` without a key. Setting the key is what registers the
 * backend — an unregistered one is absent from the picker rather than present
 * and failing on the first message.
 */
export function anthropicFromEnv(): AnthropicSettings | undefined {
    const apiKey = readEnv('ANTHROPIC_API_KEY');
    if (!apiKey) {
        return undefined;
    }
    return defined({
        apiKey,
        models: readList(
            'COPILOT_ANTHROPIC_MODELS',
            'claude-opus-5,claude-sonnet-5,claude-haiku-4-5'
        ),
        baseUrl: readEnv('ANTHROPIC_BASE_URL')
    });
}

/** `@orthacms/copilot-provider-openai`'s settings. */
export interface OpenAiSettings {
    baseUrl: string;
    models: string[];
    apiKey: string;
}

/**
 * An OpenAI-compatible endpoint, or `undefined` without a base URL. There is
 * no default endpoint: one nobody named is a backend that can only time out.
 */
export function openAiFromEnv(): OpenAiSettings | undefined {
    const baseUrl = readEnv('COPILOT_OPENAI_BASE_URL');
    if (!baseUrl) {
        return undefined;
    }
    return {
        baseUrl,
        models: readList('COPILOT_OPENAI_MODELS', 'llama3.1'),
        apiKey: readEnv('COPILOT_OPENAI_API_KEY') ?? ''
    };
}

/** How much the copilot may be used. Each limit is off when unset. */
export interface CopilotQuotaSettings {
    userDailyTokens?: number;
    workspaceDailyTokens?: number;
    runsPerMinute?: number;
    maxConcurrentRuns?: number;
}

/** The usage limits, or `undefined` when none is set. */
export function copilotQuotasFromEnv(): CopilotQuotaSettings | undefined {
    const quotas = defined({
        userDailyTokens: readOptionalPositiveInt('COPILOT_USER_DAILY_TOKENS'),
        workspaceDailyTokens: readOptionalPositiveInt(
            'COPILOT_WORKSPACE_DAILY_TOKENS'
        ),
        runsPerMinute: readOptionalPositiveInt('COPILOT_RUNS_PER_MINUTE'),
        maxConcurrentRuns: readOptionalPositiveInt(
            'COPILOT_MAX_CONCURRENT_RUNS'
        )
    });
    return Object.keys(quotas).length > 0 ? quotas : undefined;
}
