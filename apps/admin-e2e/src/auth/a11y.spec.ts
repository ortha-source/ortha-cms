import { type Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import {
    mockAuthProbeUnavailable,
    mockLogin,
    mockSignedIn,
    mockSignedOut,
    mockSsoProviders
} from '../support/api/auth';
import {
    DEFAULT_INVITE,
    mockInvite,
    spyAcceptInvite
} from '../support/api/invites';
import {
    mockPasswordReset,
    spyResetPassword
} from '../support/api/passwordReset';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Automated accessibility scans (axe, WCAG 2.1 A/AA) of the admin's pages and
 * their dynamic states — where a11y issues often hide. These are a regression
 * guard, not a conformance certification (axe covers a fraction of WCAG); manual
 * keyboard/screen-reader checks remain a separate, human task.
 */
/**
 * Proof the dark palette is actually in force before a scan claims to have
 * covered it — a dark scan that silently ran in light mode is worse than none.
 */
async function expectDarkTheme(page: Page): Promise<void> {
    await expect
        .poll(async () =>
            ((await page.locator('html').getAttribute('class')) ?? '')
                .split(/\s+/)
                .includes('dark')
        )
        .toBe(true);
}

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

    // The reset screen is the third auth surface and, until now, the only one
    // never scanned. It is reached by somebody who has lost access to their
    // account, from a link, with no way to ask anyone for help — so every one of
    // its five states is somewhere a person can be stranded.
    test('reset-password page — form ready', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockPasswordReset(page);
        await resetPasswordPage.goto();
        await resetPasswordPage.heading.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reset-password page — validation errors visible', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockPasswordReset(page);
        await spyResetPassword(page);
        await resetPasswordPage.goto();
        await resetPasswordPage.heading.waitFor();

        // Two field errors at once — a short password and a confirmation that
        // does not match it — so the scan covers several `role="alert"` regions
        // pointed at by `aria-describedby`, not just one.
        await resetPasswordPage.setPassword('short', 'shorter');
        await resetPasswordPage.fieldError(/at least 12 characters/).waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reset-password page — dead link', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockPasswordReset(page, undefined, { status: 404 });
        await resetPasswordPage.goto();
        await resetPasswordPage.unavailableHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reset-password page — lookup outage', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockPasswordReset(page, undefined, { status: 500 });
        await resetPasswordPage.goto();
        await resetPasswordPage.lookupFailedHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reset-password page — submission-error banner visible', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockPasswordReset(page);
        await spyResetPassword(page, { status: 404 });
        await resetPasswordPage.goto();
        await resetPasswordPage.heading.waitFor();
        await resetPasswordPage.setPassword('correct horse battery staple');
        await resetPasswordPage.errorBanner.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reset-password page — success confirmation', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        // The end of the flow, and the only screen that replaces the form
        // outright — its heading, its hand-off link and nothing else.
        await mockSignedOut(page);
        await mockPasswordReset(page);
        await spyResetPassword(page);
        await resetPasswordPage.goto();
        await resetPasswordPage.heading.waitFor();
        await resetPasswordPage.setPassword('correct horse battery staple');
        await resetPasswordPage.doneHeading().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('reset-password page — dark theme', async ({
        page,
        resetPasswordPage,
        makeAxe
    }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await mockSignedOut(page);
        await mockPasswordReset(page);
        await resetPasswordPage.goto();
        await resetPasswordPage.heading.waitFor();
        await expectDarkTheme(page);
        await expectNoA11yViolations(makeAxe());
    });

    // The single-sign-on block is a second column of controls on the sign-in
    // card, and `?error=sso` is a banner rendered from a query parameter rather
    // than from anything the visitor did — both change the card's structure,
    // and neither was ever scanned.
    test('login page — with single-sign-on providers', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockSsoProviders(page, [
            { name: 'google', label: 'Google', kind: 'oidc' },
            { name: 'entra', label: 'Microsoft', kind: 'oidc' }
        ]);
        await loginPage.goto();
        await expect(loginPage.ssoSeparator).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });

    test('login page — returning from a failed provider sign-in', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        // Banner and provider links together: the two structures that were
        // added to this card most recently, on screen at the same time.
        await mockSignedOut(page);
        await mockSsoProviders(page, [
            { name: 'google', label: 'Google', kind: 'oidc' }
        ]);
        await page.goto('/identity/signin?error=sso');
        await loginPage.errorBanner.waitFor();
        await expect(loginPage.ssoLink('Google')).toBeVisible();
        await expectNoA11yViolations(makeAxe());
    });

    test('login page — single-sign-on block in dark theme', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await mockSignedOut(page);
        await mockSsoProviders(page, [
            { name: 'google', label: 'Google', kind: 'oidc' }
        ]);
        await loginPage.goto();
        await expect(loginPage.ssoSeparator).toBeVisible();
        await expectDarkTheme(page);
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

    // The dark palette is a second, independently authored set of colour tokens,
    // and the auth screens are the one place every user must pass through. Signed
    // out there is no stored preference to read, so the pre-paint bootstrap in
    // `index.html` resolves `system` — emulating the OS setting is what puts the
    // `.dark` class on `<html>` here.
    test('login page — dark theme', async ({ page, loginPage, makeAxe }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await mockSignedOut(page);
        await loginPage.goto();
        await loginPage.heading.waitFor();
        await expectDarkTheme(page);
        await expectNoA11yViolations(makeAxe());
    });

    test('login page — dark theme, errors visible', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await loginPage.login('admin@example.com', 'wrong-password');
        await loginPage.errorBanner.waitFor();
        await expectDarkTheme(page);
        await expectNoA11yViolations(makeAxe());
    });

    test('accept-invite page — dark theme', async ({
        page,
        acceptInvitePage,
        makeAxe
    }) => {
        await page.emulateMedia({ colorScheme: 'dark' });
        await mockSignedOut(page);
        await mockInvite(page);
        await acceptInvitePage.goto();
        await acceptInvitePage.heading.waitFor();
        await expectDarkTheme(page);
        await expectNoA11yViolations(makeAxe());
    });

    // Two `role="alert"` regions can be on screen at once here — the submission
    // banner and a field error — which the admin-e2e gotchas call out as a trap.
    // It is legal markup, so axe is the guard that it stays legal.
    test('login page — banner and field error at once', async ({
        page,
        loginPage,
        makeAxe
    }) => {
        await mockSignedOut(page);
        await mockLogin(page, { status: 401 });
        await loginPage.goto();
        await loginPage.login('admin@example.com', 'wrong-password');
        await loginPage.errorBanner.waitFor();

        // Now break the email too, so a field error joins the banner.
        await loginPage.email.fill('not-an-email');
        await loginPage.fieldError('Enter a valid email address').waitFor();
        await expect(loginPage.errorBanner).toBeVisible();

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
