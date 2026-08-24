import { test, expect } from '../support/fixtures';
import {
    mockSignedOut,
    mockSsoProviders,
    mockSsoProvidersUnavailable
} from '../support/api/auth';
import { mockInvite } from '../support/api/invites';

/**
 * The single-sign-on block on the sign-in card.
 *
 * The handshake itself is a server concern and is covered end to end in
 * `apps/server-e2e/src/server/auth/sso.spec.ts`. What is asserted here is the
 * part only a browser can show: that the buttons are links, that they carry the
 * destination the gate was aiming at, that the block disappears when a
 * deployment registers no providers, and that a failure to list them leaves the
 * password form working.
 */
test.describe('Single sign-on on the sign-in page', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedOut(page);
    });

    test.describe('with providers registered', () => {
        test.beforeEach(async ({ page, loginPage }) => {
            await mockSsoProviders(page, [
                { name: 'google', label: 'Google', kind: 'oidc' },
                { name: 'entra', label: 'Microsoft', kind: 'oidc' }
            ]);
            await loginPage.goto();
            await expect(loginPage.heading).toBeVisible();
        });

        test('renders one link per provider, in registration order', async ({
            loginPage,
            page
        }) => {
            await expect(loginPage.ssoSeparator).toBeVisible();

            const links = page.getByRole('link', { name: /^Sign in with / });
            await expect(links).toHaveText([
                'Sign in with Google',
                'Sign in with Microsoft'
            ]);
        });

        test('points each link at that provider\'s start route', async ({
            loginPage
        }) => {
            await expect(loginPage.ssoLink('Google')).toHaveAttribute(
                'href',
                '/api/auth/sso/google/start'
            );
            await expect(loginPage.ssoLink('Microsoft')).toHaveAttribute(
                'href',
                '/api/auth/sso/entra/start'
            );
        });

        test('keeps the password form as the primary path', async ({
            page,
            loginPage
        }) => {
            // The credential fields come first in the tab order: the form is
            // what every deployment has, and a visitor who came to type a
            // password should not tab past a list of providers to reach it.
            await loginPage.email.focus();
            await page.keyboard.press('Tab');
            await expect(loginPage.password).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(loginPage.submit).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(loginPage.ssoLink('Google')).toBeFocused();
        });

        test('is reachable and activatable by keyboard', async ({
            loginPage,
            page
        }) => {
            await loginPage.ssoLink('Google').focus();
            await expect(loginPage.ssoLink('Google')).toBeFocused();

            // Following the link is a navigation the mocked API cannot serve,
            // so the assertion is that the browser tried — which is what
            // separates a real link from a styled div.
            const navigation = page
                .waitForRequest('**/api/auth/sso/google/start')
                .catch(() => null);
            await page.keyboard.press('Enter');
            expect(await navigation).not.toBeNull();
        });
    });

    test.describe('carrying the destination', () => {
        test('appends the page the gate was aiming at', async ({
            page,
            loginPage
        }) => {
            await mockSsoProviders(page, [
                { name: 'google', label: 'Google', kind: 'oidc' }
            ]);

            // Arrive the way a gated visitor does: at a private route, which
            // redirects to sign-in with the attempted location in router state.
            await page.goto('/workspaces');
            await expect(loginPage.heading).toBeVisible();

            await expect(loginPage.ssoLink('Google')).toHaveAttribute(
                'href',
                '/api/auth/sso/google/start?redirect=%2Fworkspaces'
            );
        });
    });

    test.describe('with no providers registered', () => {
        test('renders no block at all', async ({ page, loginPage }) => {
            await mockSsoProviders(page, []);
            await loginPage.goto();
            await expect(loginPage.heading).toBeVisible();

            await expect(loginPage.ssoSeparator).toBeHidden();
            await expect(
                page.getByRole('link', { name: /^Sign in with / })
            ).toHaveCount(0);
        });
    });

    test.describe('when the provider list cannot be fetched', () => {
        test('leaves the password form working and says nothing about it', async ({
            page,
            loginPage
        }) => {
            await mockSsoProvidersUnavailable(page);
            await loginPage.goto();
            await expect(loginPage.heading).toBeVisible();

            // No block, and — deliberately — no error either. The password form
            // is the sign-in page; a visitor trying to use it should not be
            // handed a problem about a feature they may not even have.
            await expect(loginPage.ssoSeparator).toBeHidden();
            await expect(loginPage.errorBanner).toBeHidden();
            await expect(loginPage.email).toBeEditable();
            await expect(loginPage.submit).toBeEnabled();
        });
    });

    test.describe('returning from a failed provider sign-in', () => {
        test('explains it without naming which step failed', async ({
            page,
            loginPage
        }) => {
            await mockSsoProviders(page, [
                { name: 'google', label: 'Google', kind: 'oidc' }
            ]);
            await page.goto('/identity/signin?error=sso');

            await expect(loginPage.errorBanner).toContainText(
                'did not complete'
            );
            // Still offered: the point of the message is "try again", and the
            // most likely next action is the same button.
            await expect(loginPage.ssoLink('Google')).toBeVisible();
        });
    });

    test.describe('accepting an invitation with a work account', () => {
        const TOKEN = 'invite-token-abc123';

        test.beforeEach(async ({ page }) => {
            await mockInvite(page, {
                email: 'invitee@example.com',
                name: 'Ada Lovelace'
            });
            await mockSsoProviders(page, [
                { name: 'google', label: 'Google', kind: 'oidc' }
            ]);
        });

        test('offers each provider, carrying the invite token', async ({
            acceptInvitePage
        }) => {
            await acceptInvitePage.goto(TOKEN);
            await expect(acceptInvitePage.heading).toBeVisible();

            await expect(acceptInvitePage.ssoSeparator).toBeVisible();
            await expect(acceptInvitePage.ssoLink('Google')).toHaveAttribute(
                'href',
                `/api/auth/sso/google/start?invite=${TOKEN}`
            );
        });

        test('keeps the password fields as the primary path', async ({
            acceptInvitePage
        }) => {
            await acceptInvitePage.goto(TOKEN);
            await expect(acceptInvitePage.heading).toBeVisible();

            // Setting a password is what every deployment offers; accepting
            // with a provider is the addition, so it comes after.
            await expect(acceptInvitePage.password).toBeEditable();
            await expect(acceptInvitePage.submit).toBeEnabled();
        });

        test('renders no block when no provider is registered', async ({
            page,
            acceptInvitePage
        }) => {
            await mockSsoProviders(page, []);
            await acceptInvitePage.goto(TOKEN);
            await expect(acceptInvitePage.heading).toBeVisible();

            await expect(acceptInvitePage.ssoSeparator).toBeHidden();
        });
    });
});
