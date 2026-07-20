import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ApiError } from '@ortha-cms/utils-admin';
import type { ThemePreference } from '@ortha-cms/design-system';
import {
    httpPreferencesGateway,
    preferencesKeys,
    type UserPreferences
} from '../../infrastructure/preferencesGateway';

/**
 * Persists the signed-in user's theme choice via the gateway. On success it
 * writes the returned preferences straight into the query cache — no
 * invalidation/refetch — so the tab and the app-wide theme hydration stay in
 * lockstep with the server without an extra round-trip. Errors are already
 * normalized to {@link ApiError} by the gateway, so the page can surface a toast.
 */
export function useUpdateTheme() {
    const queryClient = useQueryClient();

    return useMutation<UserPreferences, ApiError, ThemePreference>({
        mutationFn: (theme) => httpPreferencesGateway.updateTheme(theme),
        onSuccess: (preferences) => {
            queryClient.setQueryData(preferencesKeys.me, preferences);
        }
    });
}
