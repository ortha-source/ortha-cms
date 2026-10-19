import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ApiError } from '@orthacms/utils-admin';
import type { PanelLayout } from '@orthacms/design-system';
import { AuthStatus, useAuth } from '@orthacms/identity-admin';
import {
    httpPreferencesGateway,
    preferencesKeys,
    type UserPreferences
} from '../../infrastructure/preferencesGateway';

/**
 * Persists changed panel layouts via the gateway, writing the returned
 * preferences straight into the query cache like `useUpdateTheme` does —
 * scoped to *this* user for the same reason.
 */
export function useUpdatePanelLayout() {
    const queryClient = useQueryClient();
    const auth = useAuth();
    const userId =
        auth.status === AuthStatus.Authenticated ? auth.user.id : undefined;

    return useMutation<UserPreferences, ApiError, PanelLayout>({
        mutationFn: (layout) => httpPreferencesGateway.updateLayout(layout),
        onSuccess: (preferences) => {
            if (userId) {
                queryClient.setQueryData(
                    preferencesKeys.forUser(userId),
                    preferences
                );
            }
        }
    });
}
