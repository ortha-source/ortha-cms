import { test, expect } from '../support/fixtures';
import { mockSignedOut } from '../support/api/auth';

/**
 * What happens when a lazily-loaded auth screen never arrives.
 *
 * The realistic cause is a **deploy while a tab was open**: the browser still
 * holds the previous `index.html`, whose chunk filenames are content-hashed and
 * no longer exist on the server, so the dynamic `import()` behind
 * `/identity/signin` rejects. `Suspense` handles *waiting*, not *failing* — it
 * re-throws — so with no boundary the whole app unmounted to a blank white page.
 *
 * On this route specifically that is the worst possible failure: the user cannot
 * get in, and a blank page gives no hint that reloading is the fix.
 */
test.describe('a chunk that never loads', () => {
    test('shows a recoverable card instead of blanking the page', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        // Stand in for the vanished asset. Any request carrying the lazy page's
        // module path is failed, which is what a stale content hash amounts to.
        await page.route('**/LoginPage/**', (route) => route.abort());

        await loginPage.goto();

        await expect(loginPage.chunkErrorHeading).toBeVisible({
            timeout: 15_000
        });
        // The page still has to be usable — the point of the boundary is that
        // something actionable renders, not merely that React stopped throwing.
        await expect(loginPage.chunkErrorReload).toBeVisible();
    });

    test('the failure is announced as a heading, not left as bare text', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await page.route('**/LoginPage/**', (route) => route.abort());

        await loginPage.goto();

        // A screen-reader user navigating by heading has to be able to find the
        // failure; the boundary renders an `<h1>` like every other auth surface.
        await expect(loginPage.chunkErrorHeading).toBeVisible({
            timeout: 15_000
        });
        await expect(loginPage.chunkErrorHeading).toBeFocused();
    });
});
