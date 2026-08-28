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

    /**
     * The host's catch-all above cannot reach these. The identity plugin
     * contributes `/identity/*` as a single wildcard route, so every address in
     * that subtree is claimed by its nested `<Routes>` — and a `<Routes>` with
     * no matching child renders **nothing**. These paths used to answer with a
     * blank document: no heading, no text, no way back.
     *
     * It is the worst subtree for that to happen in. Everything under
     * `/identity` is reached from a link in someone's inbox, and the invite
     * screen already carries copy about chat clients cutting long links in
     * half — but that copy only appears when the truncation takes the *token*.
     * Cut a few characters earlier and it takes the *path* instead, landing
     * here, where the flow that had been written to explain itself said
     * nothing at all.
     */
    test.describe('an address under /identity that names no screen', () => {
        for (const path of [
            '/identity/nope',
            '/identity/signin/extra',
            // The realistic one: an invite link truncated in the path rather
            // than the query.
            '/identity/accept-inv'
        ]) {
            test(`explains itself at ${path}`, async ({ page }) => {
                await mockSignedOut(page);
                await page.goto(path);

                await expect(
                    page.getByRole('heading', {
                        name: /this link doesn’t go anywhere/i
                    })
                ).toBeVisible();
                // A way out, since the visitor arrived by link and has no
                // navigation around them.
                await expect(
                    page.getByRole('link', { name: /go to sign in/i })
                ).toBeVisible();
                // The address is left alone rather than rewritten, so a reload
                // shows the same explanation instead of quietly becoming a
                // sign-in form the visitor never asked for.
                await expect(page).toHaveURL(path);
            });
        }

        test('names itself in the tab title', async ({ page }) => {
            await mockSignedOut(page);
            await page.goto('/identity/nope');

            await expect(page).toHaveTitle(/^Link not found · /);
        });

        test('leaves the real auth routes alone', async ({
            page,
            loginPage
        }) => {
            await mockSignedOut(page);
            await page.goto('/identity/signin');

            await expect(loginPage.heading).toBeVisible();
        });
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
