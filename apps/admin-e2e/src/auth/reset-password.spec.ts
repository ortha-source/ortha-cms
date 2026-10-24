import { test, expect } from '../support/fixtures';
import { mockSignedOut } from '../support/api/auth';
import {
    DEFAULT_RESET,
    mockPasswordReset,
    spyResetPassword
} from '../support/api/passwordReset';

/** Comfortably over the 12-character minimum the form enforces. */
const GOOD_PASSWORD = 'correct horse battery staple';

/** A token with the shape the server mints (64 hex characters). */
const TOKEN = '9a'.repeat(32);

/**
 * The reset screen at `/identity/reset-password?token=…` — where a member ends
 * up after an admin hands them a link from the Sessions & access tab, or after
 * asking for one on the "Forgot it?" screen.
 *
 * The route is public, so the tests seed only the reset lookup: someone
 * resetting a password is by definition not signed in, which is the premise of
 * the page.
 */
test.describe('reset a password', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedOut(page);
    });

    test('names the account the link opens and asks only for a password', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        await resetPasswordPage.goto();

        await expect(resetPasswordPage.heading).toBeVisible();
        // The account came from the token, so it is named under the heading,
        // not asked for — a link cannot be pointed at a different account.
        await expect(resetPasswordPage.account).toHaveText(
            `for ${DEFAULT_RESET.email}`
        );
        await expect(page.getByRole('textbox', { name: 'Email' })).toHaveCount(
            0
        );

        // One field with a meter and a reveal toggle, and the consequence
        // said before the button rather than after it.
        await expect(resetPasswordPage.password).toBeEditable();
        await expect(page.locator('input[type="password"]')).toHaveCount(1);
        await expect(resetPasswordPage.signOutNote()).toBeVisible();
        const note = await resetPasswordPage.signOutNote().boundingBox();
        const submit = await resetPasswordPage.submit.boundingBox();
        expect(note!.y).toBeLessThan(submit!.y);
    });

    test('rates the new password and can show it', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        await resetPasswordPage.goto();

        await resetPasswordPage.password.fill(GOOD_PASSWORD);
        await expect(
            page.getByText('Strong · at least 12 characters')
        ).toBeVisible();
        await resetPasswordPage.revealPassword.click();
        await expect(resetPasswordPage.password).toHaveAttribute(
            'type',
            'text'
        );
    });

    test('submits the token with the password and hands off to sign-in', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        const spy = await spyResetPassword(page);

        await resetPasswordPage.goto(TOKEN);
        await expect(resetPasswordPage.heading).toBeVisible();
        await resetPasswordPage.setPassword(GOOD_PASSWORD);

        // The redemption revokes every session and issues none, so the page
        // must not pretend the user is now inside the app.
        await expect(resetPasswordPage.doneHeading()).toBeVisible();
        await expect(
            page.getByText(
                'Sign in with it now. Other devices were signed out.'
            )
        ).toBeVisible();
        await expect(resetPasswordPage.signInLink()).toBeVisible();

        expect(spy.count).toBe(1);
        expect(spy.bodies[0]).toEqual({
            token: TOKEN,
            password: GOOD_PASSWORD
        });
    });

    test('does not re-report the spent link as dead after succeeding', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        await spyResetPassword(page);

        await resetPasswordPage.goto();
        await expect(resetPasswordPage.heading).toBeVisible();
        await resetPasswordPage.setPassword(GOOD_PASSWORD);

        // The token is spent by definition once this succeeds; a refetch would
        // report it dead, and telling someone who just succeeded that their
        // link no longer works is exactly the wrong ending.
        await expect(resetPasswordPage.doneHeading()).toBeVisible();
        await expect(resetPasswordPage.unavailableHeading()).toBeHidden();
    });

    test('refuses to submit a password that is too short', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        const spy = await spyResetPassword(page);

        await resetPasswordPage.goto();
        await expect(resetPasswordPage.heading).toBeVisible();
        await resetPasswordPage.setPassword('short');

        await expect(
            resetPasswordPage.fieldError(/Use at least 12 characters/)
        ).toBeVisible();
        expect(spy.count).toBe(0);
    });

    test('explains a dead link and offers sign-in', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page, DEFAULT_RESET, { status: 404 });
        await resetPasswordPage.goto();

        await expect(resetPasswordPage.unavailableHeading()).toBeVisible();
        await expect(resetPasswordPage.signInLink()).toBeVisible();
        await expect(resetPasswordPage.password).toBeHidden();
        // …and the way to a fresh one, which the "Forgot it?" screen either
        // sends or says who can make.
        await expect(resetPasswordPage.requestNewLink()).toHaveAttribute(
            'href',
            '/identity/forgot-password'
        );
    });

    test('treats a link with no token as a truncated one, not a dead one', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        await resetPasswordPage.gotoWithoutToken();

        await expect(resetPasswordPage.incompleteHeading()).toBeVisible();
        await expect(resetPasswordPage.unavailableHeading()).toHaveCount(0);
        // The advice differs: this is fixable by opening the link properly.
        await expect(
            page.getByText(/Open it again from the original message/)
        ).toBeVisible();
    });

    test('calls a token cut short incomplete without asking the server', async ({
        page,
        resetPasswordPage
    }) => {
        const lookups: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/auth/reset/')) {
                lookups.push(request.url());
            }
        });
        await mockPasswordReset(page);
        await resetPasswordPage.goto(TOKEN.slice(0, 50));

        await expect(resetPasswordPage.incompleteHeading()).toBeVisible();
        expect(lookups).toEqual([]);
    });

    test('offers a retry — not a replacement — when the lookup itself fails', async ({
        page,
        resetPasswordPage
    }) => {
        // A `500` says nothing about the token. Reporting it as a dead link
        // would send someone to ask for a new one, which *invalidates* the
        // perfectly good link they are holding.
        await mockPasswordReset(page, DEFAULT_RESET, { status: 500 });
        await resetPasswordPage.goto();

        await expect(resetPasswordPage.lookupFailedHeading()).toBeVisible();
        await expect(resetPasswordPage.retryLookup()).toBeVisible();
        await expect(resetPasswordPage.unavailableHeading()).toBeHidden();
    });

    test('reports a link that died while the form was open', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        await spyResetPassword(page, { status: 404 });

        await resetPasswordPage.goto();
        await expect(resetPasswordPage.heading).toBeVisible();
        await resetPasswordPage.setPassword(GOOD_PASSWORD);

        await expect(resetPasswordPage.errorBanner).toBeVisible();
        await expect(resetPasswordPage.doneHeading()).toBeHidden();
    });
});
