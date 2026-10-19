import { type Page } from '@playwright/test';

/** A theme value, mirroring the server's `theme_preference` enum. */
export type ThemeSeed = 'light' | 'dark' | 'system';

/** One panel's stored layout, mirroring the server's `user_preferences.layout`. */
export type PanelLayoutSeed = Record<
    string,
    { width?: number; collapsed?: boolean }
>;

/** Handle returned by {@link mockPreferences} to inspect writes. */
export interface PreferencesMock {
    /** The themes sent to `PUT /api/preferences`, in order. */
    readonly puts: ThemeSeed[];
    /** The `layout` patches sent to `PUT /api/preferences`, in order. */
    readonly layoutPuts: PanelLayoutSeed[];
    /** The layout as the "server" holds it now, every patch merged in. */
    readonly layout: PanelLayoutSeed;
}

/**
 * Stub `GET`/`PUT /api/preferences` — the front-end analog of the server
 * suite's `user_preferences` row. `GET` returns the seeded theme (default
 * `system`, as a brand-new user reads) and layout (default `{}`); `PUT` is the
 * server's partial patch — a theme replaces the theme, a layout merges per panel
 * — echoes the row back as the upsert does, and records what was sent so a test
 * can assert the save fired. Registered per-`page`, so it resets between tests
 * with the browser context.
 */
export async function mockPreferences(
    page: Page,
    {
        theme = 'system' as ThemeSeed,
        layout = {} as PanelLayoutSeed
    }: { theme?: ThemeSeed; layout?: PanelLayoutSeed } = {}
): Promise<PreferencesMock> {
    const puts: ThemeSeed[] = [];
    const layoutPuts: PanelLayoutSeed[] = [];
    const row = { theme, layout: { ...layout } };
    await page.route('**/api/preferences', async (route) => {
        if (route.request().method() === 'PUT') {
            const body = JSON.parse(route.request().postData() ?? '{}');
            if (body.theme !== undefined) {
                puts.push(body.theme);
                row.theme = body.theme;
            }
            if (body.layout !== undefined) {
                layoutPuts.push(body.layout);
                row.layout = { ...row.layout, ...body.layout };
            }
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(row)
        });
    });
    return {
        get puts() {
            return puts;
        },
        get layoutPuts() {
            return layoutPuts;
        },
        get layout() {
            return row.layout;
        }
    };
}
