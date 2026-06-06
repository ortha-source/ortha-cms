import { test, expect } from '../support/fixtures';
import { mockLogin } from '../support/api/auth';

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
        await loginPage.goto();
        await page.keyboard.press('Tab');
        await expect(loginPage.email).toBeFocused();
    });

    test('login can be completed and submitted by keyboard alone', async ({
        page,
        loginPage,
        homePage
    }) => {
        await mockLogin(page, { status: 201 });
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
