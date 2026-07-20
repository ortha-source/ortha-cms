import type { ThemePreference } from '@ortha-cms/design-system';

/**
 * The current user's preferences as returned by `GET /api/preferences` and
 * accepted (as a body) by `PUT /api/preferences`. Today that is just the colour
 * theme; the shape is an object so more self-service preferences can join it
 * without changing the endpoint contract.
 */
export interface UserPreferences {
    /** The user's chosen colour theme. */
    theme: ThemePreference;
}

/** React Query key for the current user's preferences. */
export const preferencesKey = ['preferences', 'me'] as const;
