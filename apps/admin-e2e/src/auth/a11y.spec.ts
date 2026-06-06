import { test } from '../support/fixtures';
import { mockLogin } from '../support/api/auth';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Automated accessibility scans (axe, WCAG 2.1 A/AA) of the admin's pages and
 * their dynamic states — where a11y issues often hide. These are a regression
 * guard, not a conformance certification (axe covers a fraction of WCAG); manual
 * keyboard/screen-reader checks remain a separate, human task.
 */
test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
    test('login page — initial', async ({ loginPage, makeAxe }) => {
        await loginPage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('login page — required-field errors visible', async ({
        loginPage,
        makeAxe
    }) => {
        await loginPage.goto();
        await loginPage.submit.click();
        await loginPage.fieldError('Email is required').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('login page — credential-error banner visible', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await loginPage.login('admin@example.com', 'wrong-password');
        await loginPage.errorBanner.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('home page', async ({ homePage, makeAxe }) => {
        await homePage.goto();
        await expectNoA11yViolations(makeAxe());
    });
});
