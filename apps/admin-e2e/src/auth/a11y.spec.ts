import { test } from '../support/fixtures';
import {
    mockAuthProbeUnavailable,
    mockLogin,
    mockSignedIn,
    mockSignedOut
} from '../support/api/auth';
import {
    DEFAULT_INVITE,
    mockInvite,
    spyAcceptInvite
} from '../support/api/invites';
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

    test('accept-invite page — form ready', async ({
        page,
        acceptInvitePage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        await acceptInvitePage.goto();
        await acceptInvitePage.heading.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('accept-invite page — validation errors visible', async ({
        page,
        acceptInvitePage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        await acceptInvitePage.goto();
        await acceptInvitePage.heading.waitFor();
        await acceptInvitePage.submit.click();
        await acceptInvitePage.fieldError(/Choose a password/).waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('accept-invite page — submission-error banner visible', async ({
        page,
        acceptInvitePage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockInvite(page);
        await spyAcceptInvite(page, { status: 404 });
        await acceptInvitePage.goto();
        await acceptInvitePage.heading.waitFor();
        await acceptInvitePage.setPassword('correct horse battery staple');
        await acceptInvitePage.errorBanner.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('accept-invite page — dead link', async ({
        page,
        acceptInvitePage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockInvite(page, DEFAULT_INVITE, { status: 404 });
        await acceptInvitePage.goto();
        await acceptInvitePage.unavailableHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('accept-invite page — lookup outage', async ({
        page,
        acceptInvitePage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockInvite(page, DEFAULT_INVITE, { status: 500 });
        await acceptInvitePage.goto();
        await acceptInvitePage.lookupFailedHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('auth gate — probe unavailable', async ({
        page,
        homePage,
        makeAxe
    }) => {
        await mockAuthProbeUnavailable(page);
        await homePage.goto();
        await homePage.authUnavailableHeading().waitFor();
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
