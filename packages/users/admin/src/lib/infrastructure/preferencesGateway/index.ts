import { apiClient, toApiError } from '@orthacms/utils-admin';
import type { PanelLayout, ThemePreference } from '@orthacms/design-system';

/**
 * The current user's own preferences, as carried over `/api/preferences`: the
 * colour theme and the layout of the admin's resizable panels. A save is a
 * partial patch, so each travels without the other.
 */
export type UserPreferences = {
    /** The user's chosen colour theme. */
    theme: ThemePreference;
    /**
     * Widths and collapsed states of the resizable panels, by panel id. Absent
     * from a server that predates it, so readers default it to `{}`.
     */
    layout?: PanelLayout;
};

/**
 * React Query keys for a user's own preferences. Distinct from `membersKeys` —
 * these are the caller's *own* app preferences, not a member record, so they
 * never invalidate alongside the members list.
 *
 * The key is scoped **by user id**, not a flat `'me'`. Sign-out only invalidates
 * the current-user query; every other cache entry survives it. With a shared
 * `'me'` key, signing in as someone else on the same machine would read the
 * previous user's cached theme (and, because this query never goes stale, never
 * refetch to correct it). Scoping by id makes that structurally impossible.
 */
export const preferencesKeys = {
    /** One user's preferences. */
    forUser: (userId: string) => ['preferences', userId] as const
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

    /**
     * Persists changed panels, returning the stored row. The server merges per
     * panel, so only the panels that changed are sent — another tab's resize
     * of a different panel survives this save.
     */
    async updateLayout(layout: PanelLayout): Promise<UserPreferences> {
        try {
            const response = await apiClient.put<UserPreferences>(
                '/preferences',
                { layout }
            );
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
