import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    apiClient,
    toApiError,
    type ApiError
} from '@ortha-cms/utils-admin';
import type { ThemePreference } from '@ortha-cms/design-system';
import { preferencesKey, type UserPreferences } from '../preferences/types';

/**
 * Persists the current user's theme choice (`PUT /api/preferences`). On success
 * it writes the returned preferences straight into the query cache — no
 * invalidation/refetch — so the page and the app-wide theme hydration stay in
 * lockstep with the server without an extra round-trip. Errors normalize to
 * {@link ApiError} so the page can surface a toast.
 */
export function useUpdateTheme() {
    const queryClient = useQueryClient();

    return useMutation<UserPreferences, ApiError, ThemePreference>({
        mutationFn: async (theme) => {
            try {
                const response = await apiClient.put<UserPreferences>(
                    '/preferences',
                    { theme }
                );
                return response.data;
            } catch (error) {
                throw toApiError(error);
            }
        },
        onSuccess: (preferences) => {
            queryClient.setQueryData(preferencesKey, preferences);
        }
    });
}
