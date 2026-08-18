import { test, expect } from '../support/fixtures';
import { mockSignedOut } from '../support/api/auth';
import {
    DEFAULT_RESET,
    mockPasswordReset,
    spyResetPassword
} from '../support/api/passwordReset';

/** Comfortably over the 12-character minimum the form enforces. */
const GOOD_PASSWORD = 'correct horse battery staple';

/**
 * The reset screen at `/identity/reset-password?token=…` — where a member ends
 * up after an admin hands them a link from the Access tab.
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
        // The email came from the token, so it is shown, not asked for — a
        // link cannot be pointed at a different account by editing a field.
        await expect(resetPasswordPage.emailField()).toHaveValue(
            DEFAULT_RESET.email
        );
        await expect(resetPasswordPage.emailField()).toHaveAttribute(
            'readonly',
            ''
        );

        await expect(resetPasswordPage.password).toBeEditable();
        await expect(resetPasswordPage.confirmPassword).toBeEditable();
    });

    test('submits the token with the password and hands off to sign-in', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        const spy = await spyResetPassword(page);

        await resetPasswordPage.goto('reset-token-xyz');
        await expect(resetPasswordPage.heading).toBeVisible();
        await resetPasswordPage.setPassword(GOOD_PASSWORD);

        // The redemption revokes every session and issues none, so the page
        // must not pretend the user is now inside the app.
        await expect(resetPasswordPage.doneHeading()).toBeVisible();
        await expect(resetPasswordPage.signInLink()).toBeVisible();

        expect(spy.count).toBe(1);
        expect(spy.bodies[0]).toEqual({
            token: 'reset-token-xyz',
            password: GOOD_PASSWORD,
            confirmPassword: GOOD_PASSWORD
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
            resetPasswordPage.fieldError(/at least 12 characters/)
        ).toBeVisible();
        expect(spy.count).toBe(0);
    });

    test('refuses to submit when the confirmation does not match', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        const spy = await spyResetPassword(page);

        await resetPasswordPage.goto();
        await expect(resetPasswordPage.heading).toBeVisible();
        await resetPasswordPage.setPassword(GOOD_PASSWORD, `${GOOD_PASSWORD}!`);

        await expect(resetPasswordPage.fieldError(/don’t match/)).toBeVisible();
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
    });

    test('treats a link with no token as a truncated one, not a dead one', async ({
        page,
        resetPasswordPage
    }) => {
        await mockPasswordReset(page);
        await resetPasswordPage.gotoWithoutToken();

        await expect(resetPasswordPage.unavailableHeading()).toBeVisible();
        // The advice differs: this is fixable by opening the link properly,
        // so the copy must not send the user off to ask for a replacement.
        await expect(
            resetPasswordPage.fieldError(/missing its reset code/)
        ).toBeVisible();
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
