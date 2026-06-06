import { test, expect } from '../support/fixtures';

/**
 * Top-level admin routing assembled by `createAdmin` + the identity plugin's
 * nested router: `/identity` redirects to the sign-in page, unknown paths fall
 * through the catch-all to `/`, and `/` serves the home page.
 */
test.describe('Admin routing', () => {
    test('/identity redirects to the sign-in page', async ({
        page,
        loginPage
    }) => {
        await page.goto('/identity');

        await expect(page).toHaveURL(/\/identity\/signin$/);
        await expect(loginPage.heading).toBeVisible();
    });

    test('an unknown path redirects to home', async ({ page, homePage }) => {
        await page.goto('/this-route-does-not-exist');

        await expect(page).toHaveURL('/');
        await expect(homePage.heading).toBeVisible();
    });

    test('serves the home page at /', async ({ homePage }) => {
        await homePage.goto();
        await expect(homePage.heading).toBeVisible();
    });
});
