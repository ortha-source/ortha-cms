import { test, expect } from '../support/fixtures';
import {
    mockLogin,
    mockSignedIn,
    mockSignedOut,
    mockUnauthorized
} from '../support/api/auth';
import { mockMembers } from '../support/api/members';

const EMAIL = 'admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The auth gate (`RequireAuth` from `identity-admin`, composed into the shell's
 * layout). Every non-public
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

/**
 * A session can die while a tab is open — an admin suspends the account (which
 * revokes its sessions server-side), it expires, or another device kills it.
 * The next request comes back `401`, and the shared client's global handler
 * turns that into a real sign-out instead of a page that keeps failing in place.
 *
 * `GET /api/auth/me` stays mocked as **signed in** throughout, so the redirect
 * can only come from the `401` on the data request.
 */
test.describe('Session lost mid-visit', () => {
    test('redirects to the sign-in page when a request comes back 401', async ({
        page,
        loginPage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // The session dies; the next list request is refused.
        await mockUnauthorized(page, '**/api/users?*');
        await membersPage.search.fill('ada');

        await expect(page).toHaveURL(/\/identity\/signin$/);
        await expect(loginPage.heading).toBeVisible();
        // The private shell is gone with it — no nav left over a dead session.
        await expect(membersPage.nav).toBeHidden();
    });
});
