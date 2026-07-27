import { type Page } from '@playwright/test';

/** A theme value, mirroring the server's `theme_preference` enum. */
export type ThemeSeed = 'light' | 'dark' | 'system';

/** Handle returned by {@link mockPreferences} to inspect writes. */
export interface PreferencesMock {
    /** The themes sent to `PUT /api/preferences`, in order. */
    readonly puts: ThemeSeed[];
}

/**
 * Stub `GET`/`PUT /api/preferences` — the front-end analog of the server
 * suite's `user_preferences` row. `GET` returns the seeded theme (default
 * `system`, as a brand-new user reads); `PUT` echoes the sent theme back (as the
 * upsert does) and records it so a test can assert the save fired. Registered
 * per-`page`, so it resets between tests with the browser context.
 */
export async function mockPreferences(
    page: Page,
    { theme = 'system' as ThemeSeed }: { theme?: ThemeSeed } = {}
): Promise<PreferencesMock> {
    const puts: ThemeSeed[] = [];
    await page.route('**/api/preferences', async (route) => {
        if (route.request().method() === 'PUT') {
            const body = JSON.parse(route.request().postData() ?? '{}');
            puts.push(body.theme);
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ theme: body.theme })
            });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ theme })
        });
    });
    return {
        get puts() {
            return puts;
        }
    };
}
