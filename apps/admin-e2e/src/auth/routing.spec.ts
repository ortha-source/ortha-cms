import { test, expect } from '../support/fixtures';
import { mockSignedIn, mockSignedOut } from '../support/api/auth';

/**
 * Top-level admin routing assembled by `createAdmin` + the identity plugin's
 * nested router. The home page is a **private** route behind the host's auth
 * gate, so these assert the signed-in behavior (the gate's redirects for signed-
 * out users live in `private-routes.spec.ts`): `/identity` redirects to sign-in,
 * unknown paths fall through the catch-all to `/`, and `/` serves the home page.
 */
test.describe('Admin routing', () => {
    test('/identity redirects to the sign-in page', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await page.goto('/identity');

        await expect(page).toHaveURL(/\/identity\/signin$/);
        await expect(loginPage.heading).toBeVisible();
    });

    test('an unknown path redirects to home', async ({ page, homePage }) => {
        await mockSignedIn(page);
        await page.goto('/this-route-does-not-exist');

        await expect(page).toHaveURL('/');
        await expect(homePage.heading).toBeVisible();
    });

    test('serves the home page inside the shell at /', async ({
        page,
        homePage
    }) => {
        await mockSignedIn(page);
        await homePage.goto();
        await expect(homePage.heading).toBeVisible();
        // The private home renders inside the authenticated shell's layout.
        await expect(homePage.nav).toBeVisible();
    });
});
