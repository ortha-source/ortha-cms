import { test, expect } from '../support/fixtures';
import { mockSignedOut } from '../support/api/auth';
import {
    mockPasswordRecoveryAvailability,
    spyPasswordRecovery
} from '../support/api/passwordRecovery';
import { ForgotPasswordPage } from '../support/pages/ForgotPasswordPage';

/**
 * "Forgot it?" at `/identity/forgot-password` (R7). Two faces, chosen by the
 * deployment:
 *
 * - no mail provider (the default install): a card that says who can make a
 *   reset link and where they click — **naming nobody**, because the page is
 *   public;
 * - a mail provider: the request form, then "Check your email" — **the same
 *   screen for every address**, because the server accepts the request before
 *   it looks the address up (no enumeration signal).
 */
test.describe('forgot password', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedOut(page);
    });

    test.describe('on a deployment that sends no mail', () => {
        test.beforeEach(async ({ page }) => {
            await mockPasswordRecoveryAvailability(page, false);
        });

        test('says who can help and where they click, naming nobody', async ({
            page
        }) => {
            const forgot = new ForgotPasswordPage(page);
            await forgot.goto();

            await expect(forgot.heading).toBeVisible();
            await expect(forgot.heading).toBeFocused();
            await expect(forgot.noMailExplanation).toContainText(
                'Ask whoever invited you, or any admin'
            );
            await expect(forgot.adminPath).toBeVisible();
            // No form to fill: there is nowhere to send a link.
            await expect(forgot.email).toHaveCount(0);
            await expect(page).toHaveTitle(/Forgot your password\?/);
        });

        test('leads back to sign in', async ({ page, loginPage }) => {
            const forgot = new ForgotPasswordPage(page);
            await forgot.goto();

            await forgot.backToSignIn.click();
            await expect(page).toHaveURL(/\/identity\/signin$/);
            await expect(loginPage.heading).toBeVisible();
        });

        test('is what “Forgot it?” on the sign-in card opens', async ({
            page,
            loginPage
        }) => {
            await loginPage.goto();
            await loginPage.forgotPassword.click();

            await expect(
                new ForgotPasswordPage(page).noMailExplanation
            ).toBeVisible();
        });
    });

    test.describe('on a deployment that sends mail', () => {
        test.beforeEach(async ({ page }) => {
            await mockPasswordRecoveryAvailability(page, true);
        });

        test('sends only the address, and confirms without vouching for it', async ({
            page
        }) => {
            const recovery = await spyPasswordRecovery(page);
            const forgot = new ForgotPasswordPage(page);
            await forgot.goto();

            await forgot.request('ada@orthacms.dev');

            await expect(forgot.sentHeading).toBeVisible();
            await expect(forgot.sentHeading).toBeFocused();
            await expect(
                page.getByText(
                    'If ada@orthacms.dev belongs to an account here, a link to choose a new password is on its way.',
                    { exact: false }
                )
            ).toBeVisible();
            expect(recovery.bodies).toEqual([{ email: 'ada@orthacms.dev' }]);
        });

        test('shows the same confirmation for any address', async ({
            page
        }) => {
            // The server answers 202 before it looks; the page must not find
            // a way to differ either. Same heading, same copy, the typed
            // address echoed back — and nothing else.
            await spyPasswordRecovery(page);
            const forgot = new ForgotPasswordPage(page);

            const screens: string[] = [];
            for (const email of ['ada@orthacms.dev', 'nobody@orthacms.dev']) {
                await forgot.goto();
                await forgot.request(email);
                await expect(forgot.sentHeading).toBeVisible();
                const text = await page.locator('main').innerText();
                screens.push(text.replaceAll(email, '<email>'));
            }
            expect(screens[0]).toBe(screens[1]);
        });

        test('checks the address before asking', async ({ page }) => {
            const recovery = await spyPasswordRecovery(page);
            const forgot = new ForgotPasswordPage(page);
            await forgot.goto();

            await forgot.submit.click();
            await expect(
                page.getByText('Enter the email you sign in with', {
                    exact: true
                })
            ).toBeVisible();

            await forgot.request('not-an-email');
            await expect(
                page.getByText('Enter a valid email address')
            ).toBeVisible();
            expect(recovery.count).toBe(0);
        });

        test('keeps the throttle message generic', async ({ page }) => {
            await spyPasswordRecovery(page, {
                status: 429,
                retryAfterSeconds: 60
            });
            const forgot = new ForgotPasswordPage(page);
            await forgot.goto();

            await forgot.request('ada@orthacms.dev');

            await expect(forgot.errorBanner).toContainText(
                'Too many attempts from this device'
            );
            await expect(forgot.errorBanner).not.toContainText('account');
            await expect(forgot.sentHeading).toHaveCount(0);
        });

        test('falls back to “ask an admin” if mail was switched off meanwhile', async ({
            page
        }) => {
            await spyPasswordRecovery(page, { status: 404 });
            const forgot = new ForgotPasswordPage(page);
            await forgot.goto();

            await forgot.request('ada@orthacms.dev');

            await expect(forgot.noMailExplanation).toBeVisible();
        });
    });
});
