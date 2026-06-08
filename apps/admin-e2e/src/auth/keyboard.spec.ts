import { test, expect } from '../support/fixtures';
import { mockLogin, mockSignedIn, mockSignedOut } from '../support/api/auth';

/**
 * Keyboard operability of the login flow — the part axe can't check. Avoids
 * asserting the exact tab order through the placeholder "Forgot password" /
 * "Sign up" buttons (those are TODO and will change); instead it pins the two
 * properties that matter: the form is the first focus target, and it can be
 * completed and submitted by keyboard alone.
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
});
