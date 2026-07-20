import { useQuery } from '@tanstack/react-query';
import {
    httpPreferencesGateway,
    preferencesKeys,
    type UserPreferences
} from '../../infrastructure/preferencesGateway';

/**
 * Reads the signed-in user's stored preferences via the gateway. Disabled by
 * default so a caller only fetches once the user is authenticated (the endpoint
 * 401s otherwise); pass `enabled` from the auth state.
 *
 * The result seeds both the Preferences tab and the app-wide theme hydration,
 * so `staleTime: Infinity` keeps it from refetching under the two consumers —
 * the mutation writes the cache directly on save.
 */
export function usePreferences(enabled = true) {
    return useQuery<UserPreferences>({
        queryKey: preferencesKeys.me,
        queryFn: () => httpPreferencesGateway.get(),
        enabled,
        staleTime: Infinity,
        retry: false
    });
}
