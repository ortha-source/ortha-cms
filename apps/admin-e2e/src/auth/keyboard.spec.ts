import { test, expect } from '../support/fixtures';
import { mockLogin, mockSignedIn, mockSignedOut } from '../support/api/auth';
import { mockInvite, spyAcceptInvite } from '../support/api/invites';
import {
    mockPasswordReset,
    spyResetPassword
} from '../support/api/passwordReset';
import {
    mockPasswordRecoveryAvailability,
    spyPasswordRecovery
} from '../support/api/passwordRecovery';
import { ForgotPasswordPage } from '../support/pages/ForgotPasswordPage';

/**
 * Keyboard operability of the login flow — the part axe can't check: the form
 * is the first focus target, every stop on the way through it is a control that
 * works, and the whole thing can be completed and submitted by keyboard alone.
 */
test.describe('keyboard accessibility', () => {
    test('the email field is the first focus stop', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        // The login page is lazy-loaded behind Suspense, and the fallback has
        // a visually-hidden "Sign in" `<h1>` of its own — so a *visible*
        // heading proves nothing. Focus is the arrival signal: `AuthLayout`
        // moves it to the real page's heading, never the skeleton's. Tab
        // pressed before that lands on the loading state and goes nowhere.
        await expect(loginPage.heading).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
    });

    test('tabbing through the form hits every control in reading order, with no dead stop', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeFocused();

        // A "Forgot your password?" placeholder used to sit in the label row
        // and do nothing. R7 puts a live one there ("Forgot it?" → the
        // recovery screen), so it comes before the field in reading and tab
        // order alike; the reveal toggle sits inside the field, after it.
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.forgotPassword).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.password).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.revealPassword).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.submit).toBeFocused();
    });

    test('the reveal toggle works from the keyboard', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await loginPage.password.fill('SecurePass123!');

        await loginPage.revealPassword.focus();
        await page.keyboard.press('Space');
        await expect(loginPage.password).toHaveAttribute('type', 'text');
        await page.keyboard.press('Enter');
        await expect(loginPage.password).toHaveAttribute('type', 'password');
    });

    test('login can be completed and submitted by keyboard alone', async ({
        page,
        loginPage,
        homePage
    }) => {
        await mockLogin(page, { status: 201 });
        await mockSignedIn(page);
        await loginPage.goto();

        await loginPage.email.focus();
        await loginPage.email.pressSequentially('admin@example.com');
        await loginPage.password.focus();
        await loginPage.password.pressSequentially('SecurePass123!');
        await loginPage.password.press('Enter');

        await expect(page).toHaveURL('/');
        await expect(homePage.heading).toBeVisible();
    });

    test('an invite can be accepted by keyboard alone', async ({
        page,
        acceptInvitePage
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        const accept = await spyAcceptInvite(page);
        await acceptInvitePage.goto();
        // Lazy-loaded behind Suspense — wait for the form before typing.
        await expect(acceptInvitePage.heading).toBeVisible();

        await acceptInvitePage.password.focus();
        await acceptInvitePage.password.pressSequentially('a-long-enough-pass');
        await acceptInvitePage.password.press('Enter');

        await expect.poll(() => accept.count).toBe(1);
    });

    test('a password reset can be completed and submitted by keyboard alone', async ({
        page,
        resetPasswordPage
    }) => {
        // The reset screen is reached from a link in an email, by somebody who
        // has just lost access — the worst possible moment to discover that a
        // control cannot be operated without a mouse.
        await mockSignedOut(page);
        await mockPasswordReset(page);
        const reset = await spyResetPassword(page);
        await resetPasswordPage.goto();
        // Lazy-loaded behind Suspense — wait for the form before typing.
        await expect(resetPasswordPage.heading).toBeVisible();

        await resetPasswordPage.password.focus();
        await resetPasswordPage.password.pressSequentially(
            'a-long-enough-pass'
        );
        await resetPasswordPage.password.press('Enter');

        await expect.poll(() => reset.count).toBe(1);
        await expect(resetPasswordPage.doneHeading()).toBeVisible();
    });

    test('every reset-password field is reachable in source order', async ({
        page,
        resetPasswordPage
    }) => {
        await mockSignedOut(page);
        await mockPasswordReset(page);
        await resetPasswordPage.goto();
        await expect(resetPasswordPage.heading).toBeFocused();

        // Which account the link resets is said under the heading, which has
        // focus on arrival — read before the first Tab. Then the one field,
        // its reveal toggle and the button.
        await page.keyboard.press('Tab');
        await expect(resetPasswordPage.password).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(resetPasswordPage.revealPassword).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(resetPasswordPage.submit).toBeFocused();
    });

    test('the dead-link card offers a reachable way out', async ({
        page,
        resetPasswordPage
    }) => {
        // The failure state has to be operable too — it is the only state with
        // no form, so the sign-in link is the entire interface.
        await mockSignedOut(page);
        await mockPasswordReset(page, undefined, { status: 404 });
        await resetPasswordPage.goto();
        await expect(resetPasswordPage.unavailableHeading()).toBeVisible();

        await resetPasswordPage.signInLink().focus();
        await expect(resetPasswordPage.signInLink()).toBeFocused();
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL(/\/identity\/signin$/);
    });

    test('every accept-invite field is reachable in source order', async ({
        page,
        acceptInvitePage
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        await acceptInvitePage.goto();
        await expect(acceptInvitePage.heading).toBeFocused();

        // The prefilled name and email are `readOnly`, not `disabled`, so they
        // stay in the tab order — a screen-reader user has to be able to reach
        // and read what they are about to sign up as.
        await page.keyboard.press('Tab');
        await expect(acceptInvitePage.nameField()).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(acceptInvitePage.emailField()).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(acceptInvitePage.password).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(acceptInvitePage.revealPassword).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(acceptInvitePage.submit).toBeFocused();
    });

    test('the forgot-password request can be made by keyboard alone', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await mockPasswordRecoveryAvailability(page, true);
        const recovery = await spyPasswordRecovery(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        await loginPage.forgotPassword.focus();
        await page.keyboard.press('Enter');
        const forgot = new ForgotPasswordPage(page);
        await expect(forgot.heading).toBeVisible();

        // Focus is on the heading on arrival; the field is one Tab away.
        await page.keyboard.press('Tab');
        await expect(forgot.email).toBeFocused();
        await page.keyboard.type('ada@orthacms.dev');
        await page.keyboard.press('Enter');

        await expect(forgot.sentHeading).toBeVisible();
        await expect(forgot.sentHeading).toBeFocused();
        expect(recovery.count).toBe(1);
    });
});
