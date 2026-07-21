import { apiClient, toApiError } from '@ortha-cms/utils-admin';
import type { ThemePreference } from '@ortha-cms/design-system';

/**
 * The current user's own preferences, as carried over `/api/preferences`.
 * Today that is just the colour theme; the object shape leaves room for more
 * self-service preferences without changing the endpoint contract.
 */
export type UserPreferences = {
    /** The user's chosen colour theme. */
    theme: ThemePreference;
};

/**
 * React Query keys for the current user's preferences. Distinct from
 * `membersKeys` — these are the caller's *own* app preferences, not a member
 * record, so they never invalidate alongside the members list.
 */
export const preferencesKeys = {
    /** The signed-in user's preferences. */
    me: ['preferences', 'me'] as const
};

/**
 * The one place `/api/preferences` is spoken to. Keeps `apiClient` out of the
 * application hooks (per this plugin's layering) and normalizes transport
 * errors to `ApiError` so callers branch on status, not axios internals.
 */
export const httpPreferencesGateway = {
    /** Reads the signed-in user's preferences (defaults if never saved). */
    async get(): Promise<UserPreferences> {
        try {
            const response =
                await apiClient.get<UserPreferences>('/preferences');
            return response.data;
        } catch (error) {
            throw toApiError(error);
        }
    },

    /** Persists the signed-in user's theme choice, returning the stored row. */
    async updateTheme(theme: ThemePreference): Promise<UserPreferences> {
        try {
            const response = await apiClient.put<UserPreferences>(
                '/preferences',
                { theme }
            );
            return response.data;
        } catch (error) {
            throw toApiError(error);
        }
    }
};
