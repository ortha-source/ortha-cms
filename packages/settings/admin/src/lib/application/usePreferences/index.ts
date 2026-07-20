import { useQuery } from '@tanstack/react-query';
import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import { preferencesKey, type UserPreferences } from '../preferences/types';

/**
 * Reads the current user's stored preferences (`GET /api/preferences`). Owns its
 * own request fn — the one place this endpoint is fetched. Disabled by default
 * so a caller only fetches once the user is authenticated (the endpoint 401s
 * otherwise); pass `enabled` from the auth state.
 *
 * The result seeds both the Preferences page and the app-wide theme hydration,
 * so `staleTime: Infinity` keeps it from refetching under the two consumers —
 * the mutation writes the cache directly on save.
 */
export function usePreferences(enabled = true) {
    return useQuery({
        queryKey: preferencesKey,
        queryFn: async (): Promise<UserPreferences> => {
            try {
                const response =
                    await apiClient.get<UserPreferences>('/preferences');
                return response.data;
            } catch (error) {
                throw toApiError(error);
            }
        },
        enabled,
        staleTime: Infinity,
        retry: false
    });
}
