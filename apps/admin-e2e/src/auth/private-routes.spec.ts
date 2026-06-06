import { test, expect } from '../support/fixtures';
import { mockLogin, mockSignedIn, mockSignedOut } from '../support/api/auth';

const EMAIL = 'admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The host's auth gate (`RequireAuth` in `bootstrap-admin`). Every non-public
 * route lives behind it: a signed-out user is redirected to the sign-in page —
 * including via the catch-all, which now sits inside the guarded group — and
 * after signing in they land back on the private area. Signed-in rendering of
 * specific pages is covered in `routing.spec.ts`.
 */
test.describe('Private route gating', () => {
    test('redirects a signed-out user from / to the sign-in page', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await page.goto('/');

        await expect(page).toHaveURL(/\/identity\/signin$/);
        await expect(loginPage.heading).toBeVisible();
    });

    test('redirects a signed-out user from an unknown path to the sign-in page', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await page.goto('/this-route-does-not-exist');

        await expect(page).toHaveURL(/\/identity\/signin$/);
        await expect(loginPage.heading).toBeVisible();
    });

    test('returns to the home page after a gated user signs in', async ({
        page,
        loginPage,
        homePage
    }) => {
        await mockSignedOut(page);
        await page.goto('/');
        await expect(page).toHaveURL(/\/identity\/signin$/);

        // The session is now valid; signing in should send the user back in.
        await mockLogin(page, { status: 201 });
        await mockSignedIn(page);
        await loginPage.login(EMAIL, PASSWORD);

        await expect(page).toHaveURL('/');
        await expect(homePage.heading).toBeVisible();
        await expect(homePage.nav).toBeVisible();
    });
});
