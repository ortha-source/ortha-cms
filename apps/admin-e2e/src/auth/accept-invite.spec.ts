import { test, expect } from '../support/fixtures';
import { mockSignedIn, mockSignedOut } from '../support/api/auth';
import {
    DEFAULT_INVITE,
    mockInvite,
    spyAcceptInvite
} from '../support/api/invites';

/** Comfortably over the 12-character minimum the form enforces. */
const GOOD_PASSWORD = 'correct horse battery staple';

/**
 * The accept-invite screen at `/identity/accept-invite?token=…` — the only way
 * an invited person turns a pending account into one they can sign in with.
 *
 * The route is public, so most tests seed only the invite lookup; the ones that
 * follow the redirect into the app also seed the auth probe.
 */
test.describe('accept an invite', () => {
    test.beforeEach(async ({ page }) => {
        // Signed out by default — an invitee has no session yet, which is the
        // entire premise of the page.
        await mockSignedOut(page);
    });

    test('shows who the invite is for and asks only for a password', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.heading).toBeVisible();
        // The name and email came from the invite, so they are shown, not asked
        // for — and cannot be edited into someone else's identity.
        await expect(acceptInvitePage.nameField()).toHaveValue(
            DEFAULT_INVITE.name ?? ''
        );
        await expect(acceptInvitePage.emailField()).toHaveValue(
            DEFAULT_INVITE.email
        );
        await expect(acceptInvitePage.nameField()).toHaveAttribute(
            'readonly',
            ''
        );
        await expect(acceptInvitePage.emailField()).toHaveAttribute(
            'readonly',
            ''
        );

        await expect(acceptInvitePage.password).toBeEditable();
        await expect(acceptInvitePage.confirmPassword).toBeEditable();
    });

    test('omits the name field when the invite carries none', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page, { email: 'nameless@ortha.dev', name: null });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.heading).toBeVisible();
        await expect(acceptInvitePage.nameField()).toHaveCount(0);
        await expect(acceptInvitePage.emailField()).toHaveValue(
            'nameless@ortha.dev'
        );
    });

    test('posts the token with the password and lands in the app', async ({
        page,
        homePage,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        const accept = await spyAcceptInvite(page);
        await acceptInvitePage.goto('tok_from_the_link');
        await expect(acceptInvitePage.heading).toBeVisible();

        // Accepting activates the account and sets the session cookie, so the
        // auth probe flips to signed in — seed that before submitting, the way
        // the login suite does.
        await mockSignedIn(page, { email: DEFAULT_INVITE.email });
        await acceptInvitePage.setPassword(GOOD_PASSWORD);

        // Straight into the app, not back to the login form.
        await expect(page).toHaveURL('/');
        await expect(homePage.heading).toBeVisible();

        expect(accept.count).toBe(1);
        expect(accept.bodies[0]).toEqual({
            token: 'tok_from_the_link',
            password: GOOD_PASSWORD,
            confirmPassword: GOOD_PASSWORD
        });
    });

    test('blocks a too-short password client-side, sending no request', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        const accept = await spyAcceptInvite(page);
        await acceptInvitePage.goto();

        await acceptInvitePage.setPassword('short');

        await expect(
            acceptInvitePage.fieldError(/Use at least 12 characters/)
        ).toBeVisible();
        expect(accept.count).toBe(0);
    });

    test('blocks a mismatched confirmation, sending no request', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        const accept = await spyAcceptInvite(page);
        await acceptInvitePage.goto();

        await acceptInvitePage.setPassword(GOOD_PASSWORD, `${GOOD_PASSWORD}!`);

        await expect(acceptInvitePage.fieldError(/don’t match/)).toBeVisible();
        expect(accept.count).toBe(0);
    });

    test('flags both empty fields on submit', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        const accept = await spyAcceptInvite(page);
        await acceptInvitePage.goto();

        await acceptInvitePage.submit.click();

        await expect(
            acceptInvitePage.fieldError(/Choose a password/)
        ).toBeVisible();
        await expect(
            acceptInvitePage.fieldError(/Type your password once more/)
        ).toBeVisible();
        expect(accept.count).toBe(0);
    });

    test('explains a link that died while the form was open', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await spyAcceptInvite(page, { status: 404 });
        await acceptInvitePage.goto();

        await acceptInvitePage.setPassword(GOOD_PASSWORD);

        await expect(acceptInvitePage.errorBanner).toBeVisible();
        await expect(
            acceptInvitePage.errorBanner.filter({
                hasText: /accepted or expired/
            })
        ).toBeVisible();
        // Still on the form — the invitee can ask for a new link from here.
        await expect(page).toHaveURL(/accept-invite/);
    });

    test('explains a password the server rejected', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await spyAcceptInvite(page, { status: 400 });
        await acceptInvitePage.goto();

        await acceptInvitePage.setPassword(GOOD_PASSWORD);

        await expect(
            acceptInvitePage.errorBanner.filter({
                hasText: /didn’t meet our requirements/
            })
        ).toBeVisible();
    });

    test('shows the dead-link state for a rejected token', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page, DEFAULT_INVITE, { status: 404 });
        await acceptInvitePage.goto('expired-token');

        await expect(acceptInvitePage.unavailableHeading()).toBeVisible();
        // No form to fill — there is nothing to accept.
        await expect(acceptInvitePage.password).toHaveCount(0);
        await expect(acceptInvitePage.signInLink()).toBeVisible();
    });

    test('tells a truncated link apart from a dead one', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.gotoWithoutToken();

        await expect(acceptInvitePage.unavailableHeading()).toBeVisible();
        await expect(page.getByText(/missing its invite code/)).toBeVisible();
    });

    test('tells a server outage apart from a dead link', async ({
        page,
        acceptInvitePage
    }) => {
        // The token is untouched — only the endpoint is broken. Telling the
        // invitee their link no longer works would send them off to ask for a
        // replacement they don't need.
        await mockInvite(page, DEFAULT_INVITE, { status: 500 });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.lookupFailedHeading()).toBeVisible();
        await expect(acceptInvitePage.unavailableHeading()).toHaveCount(0);
        await expect(acceptInvitePage.retryLookup()).toBeVisible();
    });

    test('retrying a failed lookup picks up where it left off', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page, DEFAULT_INVITE, { status: 500 });
        await acceptInvitePage.goto();
        await expect(acceptInvitePage.lookupFailedHeading()).toBeVisible();

        // The API comes back (later routes win) and the same link resolves.
        await mockInvite(page);
        await acceptInvitePage.retryLookup().click();

        await expect(acceptInvitePage.heading).toBeVisible();
        await expect(acceptInvitePage.emailField()).toHaveValue(
            DEFAULT_INVITE.email
        );
    });

    test('announces the lookup while it is in flight', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page, DEFAULT_INVITE, { delayMs: 30_000 });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.loadingStatus()).toBeVisible();
    });

    test('disables the submit button while the request is in flight', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await spyAcceptInvite(page, { delayMs: 30_000 });
        await acceptInvitePage.goto();

        await acceptInvitePage.setPassword(GOOD_PASSWORD);

        await expect(acceptInvitePage.submit).toBeDisabled();
    });
});
