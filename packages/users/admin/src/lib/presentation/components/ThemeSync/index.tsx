import { useEffect } from 'react';
import { useAppearance } from '@ortha-cms/design-system';
import { AuthStatus, useAuth } from '@ortha-cms/identity-admin';
import { usePreferences } from '../../../application/usePreferences';

/**
 * Invisible bridge that pulls the signed-in user's stored theme from the server
 * into the app-wide {@link useAppearance} provider once, on load. It renders
 * nothing — it exists only for the effect — and is contributed into the shell
 * sidebar so it stays mounted across every authenticated route (a member never
 * has to open their Preferences tab for their saved theme to take effect).
 *
 * `localStorage` gives the instant, pre-paint theme (see the AppearanceProvider
 * + the index.html bootstrap); this reconciles that guess with the durable,
 * cross-device value the server holds, so signing in on a new device still
 * lands on the user's chosen theme. Setting the same value is a no-op in the
 * provider, so this never fights a change the user just made on the tab.
 */
export function ThemeSync() {
    const auth = useAuth();
    const authenticated = auth.status === AuthStatus.Authenticated;
    const { setTheme } = useAppearance();
    const { data } = usePreferences(authenticated);

    useEffect(() => {
        if (data) {
            setTheme(data.theme);
        }
    }, [data, setTheme]);

    return null;
}
