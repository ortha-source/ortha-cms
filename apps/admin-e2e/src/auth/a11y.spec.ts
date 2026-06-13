import { test } from '../support/fixtures';
import { mockLogin, mockSignedIn, mockSignedOut } from '../support/api/auth';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Automated accessibility scans (axe, WCAG 2.1 A/AA) of the admin's pages and
 * their dynamic states — where a11y issues often hide. These are a regression
 * guard, not a conformance certification (axe covers a fraction of WCAG); manual
 * keyboard/screen-reader checks remain a separate, human task.
 */
test.describe('accessibility (axe, WCAG 2.1 A/AA)', () => {
    test('login page — initial', async ({ page, loginPage, makeAxe }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('login page — required-field errors visible', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
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
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await loginPage.login('admin@example.com', 'wrong-password');
        await loginPage.errorBanner.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('home page', async ({ page, homePage, makeAxe }) => {
        await mockSignedIn(page);
        await homePage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('root loader — auth probe pending', async ({
        page,
        homePage,
        makeAxe
    }) => {
        // Hold `GET /api/auth/me` open so the gate stays in its Loading state,
        // rendering the branded AppLoader — the boot screen, scanned in isolation.
        await mockSignedIn(page, {}, { delayMs: 30_000 });
        await homePage.goto();
        await homePage.rootLoader().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
