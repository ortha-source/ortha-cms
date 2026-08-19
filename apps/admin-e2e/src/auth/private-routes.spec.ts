import { test, expect } from '../support/fixtures';
import {
    mockAuthProbeUnavailable,
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
 * The gate's third answer. `GET /api/auth/me` failing is not the same as it
 * saying "nobody": the session cookie can be perfectly valid and the endpoint
 * simply down. Redirecting on that reports an outage as a sign-out, and sends
 * the user to a form that posts to the same dead API.
 */
test.describe('Auth probe unavailable', () => {
    test('says the server is unreachable instead of signing the user out', async ({
        page,
        homePage,
        loginPage
    }) => {
        await mockAuthProbeUnavailable(page);
        await homePage.goto();

        await expect(homePage.authUnavailableHeading()).toBeVisible();
        await expect(page).toHaveURL('/');
        await expect(loginPage.heading).toHaveCount(0);
    });

    test('recovers when the API comes back', async ({ page, homePage }) => {
        await mockAuthProbeUnavailable(page);
        await homePage.goto();
        await expect(homePage.authUnavailableHeading()).toBeVisible();

        // The API recovers (later routes win) and the same session resolves.
        await mockSignedIn(page);
        await homePage.retryAuthProbe().click();

        await expect(homePage.nav).toBeVisible();
        await expect(homePage.heading).toBeVisible();
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

    test('announces the sign-out and explains it on the page it lands on', async ({
        page,
        hostPage,
        loginPage,
        membersPage
    }) => {
        // The whole view is replaced under the visitor: focus was on a control
        // that no longer exists, so the browser resets it to `<body>`, a screen
        // reader keeps reading the unmounted page, and anything typed is gone.
        // Silence there is WCAG 4.1.3 / 2.4.3 — there has to be a message.
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        await mockUnauthorized(page, '**/api/users?*');
        await membersPage.search.fill('ada');

        // Announced as it happens, in the host's live region — which lives
        // outside the router, so it survives the view being replaced.
        await expect(
            hostPage.toastHost.getByText(/Your session has ended/)
        ).toBeVisible();
        // …and repeated on the page, so it is still readable once the toast has
        // expired. Not the destructive submission banner: nothing they did
        // failed.
        await expect(loginPage.sessionEndedNotice).toBeVisible();
        await expect(loginPage.errorBanner).toBeHidden();

        // Focus lands on the sign-in heading, next to that explanation, rather
        // than being dropped to `<body>` at the top of a page nobody was told
        // they had reached.
        await expect(loginPage.heading).toBeFocused();
    });

    test('says nothing about a lost session when nobody was signed in', async ({
        page,
        loginPage
    }) => {
        // A `401` on a tab that never had a session is the ordinary signed-out
        // state — telling that visitor something of theirs was taken away would
        // be a lie.
        await mockSignedOut(page);
        await page.goto('/');

        await expect(loginPage.heading).toBeVisible();
        await expect(loginPage.sessionEndedNotice).toBeHidden();
    });

    test('drops the explanation once the visitor comes back to sign-in', async ({
        page,
        loginPage,
        membersPage
    }) => {
        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        await mockUnauthorized(page, '**/api/users?*');
        await membersPage.search.fill('ada');
        await expect(loginPage.sessionEndedNotice).toBeVisible();

        // The signal is one-shot: a later visit to the same page is an ordinary
        // arrival, not a second sign-out.
        await mockSignedOut(page);
        await page.goto('/identity/signin');
        await expect(loginPage.heading).toBeVisible();
        await expect(loginPage.sessionEndedNotice).toBeHidden();
    });

    test('redirects when the session dies under a mutation, without an unhandled error', async ({
        page,
        loginPage,
        membersPage
    }) => {
        const crashes: string[] = [];
        page.on('pageerror', (error) => crashes.push(error.message));

        await mockSignedIn(page);
        await mockMembers(page);
        await membersPage.goto();
        await expect(membersPage.heading).toBeVisible();

        // A write, not a read: the mutation rejects mid-flight while the tree
        // that fired it is being unmounted by the redirect.
        await mockUnauthorized(page, '**/api/users/*/invites/resend');
        await membersPage.openActions('alan@ortha.dev');
        await membersPage.menuItem('Resend invite').click();

        await expect(page).toHaveURL(/\/identity\/signin$/);
        await expect(loginPage.heading).toBeVisible();
        expect(crashes).toEqual([]);
    });
});

/**
 * The gate's three settled answers are covered above and in the outage suite;
 * this pins the fourth state — still resolving — because it is the one a user
 * sees on every cold load, and getting it wrong means flashing the sign-in page
 * at somebody who is signed in.
 */
test.describe('Auth still resolving', () => {
    test('holds the branded loader and never flashes the sign-in page', async ({
        page,
        homePage,
        loginPage
    }) => {
        // The probe is held open, so the gate cannot know yet.
        await mockSignedIn(page, {}, { delayMs: 3_000 });
        await homePage.goto();

        await expect(homePage.rootLoader()).toBeVisible();
        await expect(loginPage.heading).toHaveCount(0);
        await expect(page).toHaveURL('/');

        // …and it resolves into the app, not through the sign-in page.
        await expect(homePage.nav).toBeVisible({ timeout: 15_000 });
        await expect(loginPage.heading).toHaveCount(0);
    });

    test('gates every affordance while it resolves — fail-closed', async ({
        page,
        homePage,
        membersPage
    }) => {
        await mockSignedIn(page, {}, { delayMs: 3_000 });
        await homePage.goto();

        // `useHasPermission` answers `false` for every status but
        // `Authenticated`, so nothing permission-gated can render early: while
        // the loader is up there is no shell at all to hold it.
        await expect(homePage.rootLoader()).toBeVisible();
        await expect(membersPage.inviteButton).toHaveCount(0);
        await expect(homePage.nav).toHaveCount(0);
    });
});
