import { useQuery } from '@tanstack/react-query';
import { apiClient, STALE_TIME } from '@ortha-cms/utils-admin';

/** One selectable backend: a registered provider plus one of its models. */
export interface CopilotModelChoice {
    /** The provider's registered name, e.g. `claude` or `ollama`. */
    provider: string;
    /** A model id that provider offers. */
    model: string;
}

/** What `GET /api/copilot/models` returns. */
export interface CopilotModelCatalogue {
    items: CopilotModelChoice[];
    defaultProvider: string;
}

/** Query key for the model catalogue. */
export const copilotModelsKey = ['copilot', 'models'] as const;

/**
 * The backends a run may choose from.
 *
 * `STALE_TIME.Forever`: the registry is built at boot from `plugins.ts` and
 * cannot change while the tab is open, so refetching it would only add
 * requests. A deployment that adds a provider requires a restart, which the
 * user's next page load picks up anyway.
 */
export function useCopilotModels() {
    return useQuery({
        queryKey: copilotModelsKey,
        staleTime: STALE_TIME.Forever,
        queryFn: async (): Promise<CopilotModelCatalogue> => {
            const response =
                await apiClient.get<CopilotModelCatalogue>('/copilot/models');
            return response.data;
        }
    });
}

/** A stable string key for one choice, for use as a select value. */
export function modelChoiceKey(choice: CopilotModelChoice): string {
    return `${choice.provider}:${choice.model}`;
}

/** Parses a {@link modelChoiceKey} back into a choice. */
export function parseModelChoiceKey(key: string): CopilotModelChoice | null {
    // Split on the FIRST colon only: provider names can't contain one (the
    // registry rejects blanks and duplicates but not colons), while model ids
    // routinely do — `llama3.1:8b`, `qwen2.5:14b-instruct`.
    const separator = key.indexOf(':');
    if (separator <= 0 || separator === key.length - 1) {
        return null;
    }
    return {
        provider: key.slice(0, separator),
        model: key.slice(separator + 1)
    };
}
