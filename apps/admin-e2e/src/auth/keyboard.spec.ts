import { test, expect } from '../support/fixtures';
import { mockLogin, mockSignedIn, mockSignedOut } from '../support/api/auth';
import { mockInvite, spyAcceptInvite } from '../support/api/invites';

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
        // The login page is lazy-loaded behind Suspense; wait for the form so
        // Tab lands on the email field rather than the loading fallback.
        await expect(loginPage.heading).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
    });

    test('tabbing through the form hits credentials then submit, with no dead stop between', async ({
        page,
        loginPage
    }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();

        // The "Forgot your password?" placeholder used to sit in the label row
        // above the password box, i.e. between the two credential fields.
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.password).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(loginPage.submit).toBeFocused();
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
        await acceptInvitePage.goto('tok_keyboard');
        // Lazy-loaded behind Suspense — wait for the form before typing.
        await expect(acceptInvitePage.heading).toBeVisible();

        await acceptInvitePage.password.focus();
        await acceptInvitePage.password.pressSequentially('a-long-enough-pass');
        await acceptInvitePage.confirmPassword.focus();
        await acceptInvitePage.confirmPassword.pressSequentially(
            'a-long-enough-pass'
        );
        await acceptInvitePage.confirmPassword.press('Enter');

        await expect.poll(() => accept.count).toBe(1);
    });

    test('every accept-invite field is reachable in source order', async ({
        page,
        acceptInvitePage
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        await acceptInvitePage.goto();
        await expect(acceptInvitePage.heading).toBeVisible();

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
        await expect(acceptInvitePage.confirmPassword).toBeFocused();
    });
});
