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
 * Tokens with the shape the server mints (64 hex characters). Anything else is
 * caught in the browser as an incomplete link and never reaches the mocks.
 */
const token = (pair: string) => pair.repeat(32);

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

    test('shows what the invite is for and asks only for a password', async ({
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

        // What the invite grants comes first — the role and the workspaces —
        // and never who sent it: the page is public (R7).
        await expect(acceptInvitePage.scope).toHaveText(
            'as a Contributor in Marketing site and Support hub'
        );
        await expect(page.getByText(/\S+ invited you$/)).toHaveCount(0);

        // One password field, with a meter and a reveal toggle instead of a
        // second blind copy.
        await expect(acceptInvitePage.password).toBeEditable();
        await expect(page.locator('input[type="password"]')).toHaveCount(1);
        await expect(
            page.getByText('At least 12 characters', { exact: true })
        ).toBeVisible();
    });

    test('rates the password as it is typed and can show it', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.goto();

        await acceptInvitePage.password.fill(GOOD_PASSWORD);
        await expect(
            page.getByText('Strong · at least 12 characters')
        ).toBeVisible();

        await acceptInvitePage.revealPassword.click();
        await expect(acceptInvitePage.password).toHaveAttribute('type', 'text');
    });

    test('leaves out what the server could not say', async ({
        page,
        acceptInvitePage
    }) => {
        // An older server sends only email and name: the heading stands on
        // its own and nothing reads "as a undefined".
        await mockInvite(page, { email: 'ada@orthacms.dev', name: 'Ada' });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.heading).toBeVisible();
        await expect(acceptInvitePage.scope).toHaveCount(0);
    });

    test('each read-only field explains why it cannot be edited', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.goto();
        await expect(acceptInvitePage.heading).toBeVisible();

        // "Read only" with no reason leaves the invitee guessing whether they
        // are stuck. The explanation used to sit on the email alone, so a user
        // tabbing onto the name heard a locked value and nothing else — and the
        // recovery differs per field, which is why they don't share one sentence.
        await expect(acceptInvitePage.fieldDescription('name')).toContainText(
            /change it later in your profile/
        );
        await expect(acceptInvitePage.fieldDescription('email')).toContainText(
            /ask them for a new invite/
        );

        // Announced, not merely present: `InputField` points the input at its
        // description with `aria-describedby`.
        await expect(acceptInvitePage.nameField()).toHaveAttribute(
            'aria-describedby',
            /accept-invite-name-description/
        );
    });

    test('omits the name field when the invite carries none', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page, { email: 'nameless@orthacms.dev', name: null });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.heading).toBeVisible();
        await expect(acceptInvitePage.nameField()).toHaveCount(0);
        await expect(acceptInvitePage.emailField()).toHaveValue(
            'nameless@orthacms.dev'
        );
    });

    test('posts the token with the password and lands in the app', async ({
        page,
        homePage,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        const accept = await spyAcceptInvite(page);
        await acceptInvitePage.goto(token('a7'));
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
        // One password, no confirmation: the server checks a confirmation
        // only when one is sent.
        expect(accept.bodies[0]).toEqual({
            token: token('a7'),
            password: GOOD_PASSWORD
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

    test('flags the empty field on submit', async ({
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
        expect(accept.count).toBe(0);
    });

    test('gives an empty field one message, not a stack of them', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.goto();

        await acceptInvitePage.submit.click();

        // An empty box fails "required" and "at least 12 characters" alike;
        // announcing both tells the invitee to lengthen a password they have
        // not typed, in a single `role="alert"`.
        await expect(acceptInvitePage.fieldErrorRegion('password')).toHaveText(
            'Choose a password to finish setting up your account'
        );
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

    test('falls back to the generic message for any other failure', async ({
        page,
        acceptInvitePage
    }) => {
        // Only `404` (dead link) and `400` (password refused) have copy of
        // their own; a `500` must not borrow either, or it would tell the
        // invitee to fix something that isn't wrong.
        await mockInvite(page);
        await spyAcceptInvite(page, { status: 500 });
        await acceptInvitePage.goto();

        await acceptInvitePage.setPassword(GOOD_PASSWORD);

        await expect(
            acceptInvitePage.errorBanner.filter({
                hasText: /Something went wrong/
            })
        ).toBeVisible();
        await expect(page).toHaveURL(/accept-invite/);
    });

    test('keeps the form usable after a failed accept — the token is unspent', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await spyAcceptInvite(page, { status: 400 });
        await acceptInvitePage.goto(token('b8'));
        await acceptInvitePage.setPassword(GOOD_PASSWORD);
        await expect(acceptInvitePage.errorBanner).toBeVisible();

        // The accept is transactional server-side, so a rejected attempt does
        // not consume the invite: reloading has to land back on the form, not
        // on the dead-link card.
        const accept = await spyAcceptInvite(page);
        await page.reload();

        await expect(acceptInvitePage.heading).toBeVisible();
        await acceptInvitePage.setPassword(GOOD_PASSWORD);
        await expect.poll(() => accept.count).toBe(1);
    });

    test('replaces the token URL in history when the invite is accepted', async ({
        page,
        loginPage,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await spyAcceptInvite(page);
        // Arrive from somewhere, so there is a history entry behind the invite
        // and Back has a real destination to prefer.
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();
        await acceptInvitePage.goto(token('c9'));
        await expect(acceptInvitePage.heading).toBeVisible();

        await mockSignedIn(page, { email: DEFAULT_INVITE.email });
        await acceptInvitePage.setPassword(GOOD_PASSWORD);
        await expect(page).toHaveURL('/');

        // The invite URL carries a secret, so the landing replaces it rather
        // than pushing: Back steps over it to where the invitee came from.
        await page.goBack();
        await expect(page).not.toHaveURL(/accept-invite/);
        await expect(page).toHaveURL(/\/identity\/signin$/);
    });

    test('hands the tab to the invitee when somebody else was signed in', async ({
        page,
        homePage,
        acceptInvitePage
    }) => {
        // A live session opening an invite link is an odd flow, but a real one —
        // and the server is right to honour it: the token proves the invitee's
        // identity, so it issues *their* cookie and the tab changes hands. What
        // this pins is that the UI follows all the way through rather than
        // showing one account's chrome over another's session (EC-14 on ORT-57).
        await mockSignedIn(page, {
            id: 'u_root',
            name: 'Root Admin',
            email: 'root@orthacms.com'
        });
        await mockInvite(page);
        await spyAcceptInvite(page);
        await acceptInvitePage.goto(token('d0'));
        await expect(acceptInvitePage.heading).toBeVisible();

        await mockSignedIn(page, {
            id: 'u_invitee',
            email: DEFAULT_INVITE.email,
            name: DEFAULT_INVITE.name
        });
        await acceptInvitePage.setPassword(GOOD_PASSWORD);

        await expect(page).toHaveURL('/');
        await expect(homePage.nav).toBeVisible();
        await expect(
            page.getByText(DEFAULT_INVITE.email).first()
        ).toBeVisible();
        await expect(page.getByText('root@orthacms.com')).toHaveCount(0);
    });

    test('shows the dead-link state for a rejected token', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page, DEFAULT_INVITE, { status: 404 });
        await acceptInvitePage.goto(token('e1'));

        await expect(acceptInvitePage.unavailableHeading()).toBeVisible();
        // Says what is true of every reason the server folds into one 404,
        // and the next step — naming nobody: the link is dead, so whoever
        // holds it may not be the invitee.
        await expect(
            page.getByText(/Invites work once, and only for a limited time/)
        ).toBeVisible();
        await expect(page.getByText(/Ask whoever invited you/)).toBeVisible();
        // No form to fill — there is nothing to accept.
        await expect(acceptInvitePage.password).toHaveCount(0);
        await expect(acceptInvitePage.signInLink()).toBeVisible();
    });

    test('tells a link with no token apart from a dead one', async ({
        page,
        acceptInvitePage
    }) => {
        await mockInvite(page);
        await acceptInvitePage.gotoWithoutToken();

        await expect(acceptInvitePage.incompleteHeading()).toBeVisible();
        await expect(
            page.getByText(/Part of it may have been cut off/)
        ).toBeVisible();
        await expect(acceptInvitePage.unavailableHeading()).toHaveCount(0);
        await expect(acceptInvitePage.signInLink()).toBeVisible();
    });

    test('calls a token cut short incomplete without asking the server', async ({
        page,
        acceptInvitePage
    }) => {
        // The realistic break: a chat app wrapped the long link and only the
        // first half was copied. It cannot be valid, so nothing is sent.
        const lookups: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/auth/invite/')) {
                lookups.push(request.url());
            }
        });
        await mockInvite(page);
        await acceptInvitePage.goto(token('f2').slice(0, 40));

        await expect(acceptInvitePage.incompleteHeading()).toBeVisible();
        expect(lookups).toEqual([]);
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

    test('renders a name, role and workspace with markup in them as literal text', async ({
        page,
        acceptInvitePage
    }) => {
        // The name is whatever the inviting admin typed, and a workspace name
        // whatever someone called it. React escapes both — assert the
        // characters show rather than act (EC-10).
        const name = '<script>alert(1)</script>';
        await mockInvite(page, {
            email: 'script@orthacms.dev',
            name,
            role: 'Editor',
            workspaces: ['<b>Docs</b>']
        });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.heading).toBeVisible();
        await expect(acceptInvitePage.nameField()).toHaveValue(name);
        await expect(acceptInvitePage.scope).toHaveText(
            'as an Editor in <b>Docs</b>'
        );
        // Escaped, not parsed: nothing from the invite became an element.
        await expect(page.locator('#root script')).toHaveCount(0);
        await expect(page.locator('#root b', { hasText: 'Docs' })).toHaveCount(
            0
        );
    });

    test('renders an RTL name without disturbing the copy around it', async ({
        page,
        acceptInvitePage
    }) => {
        const name = 'عائشة الأنصاري';
        await mockInvite(page, { email: 'rtl@orthacms.dev', name });
        await acceptInvitePage.goto();

        await expect(acceptInvitePage.nameField()).toHaveValue(name);
        // The heading keeps its own order — no mojibake, and the English
        // around it still reads left to right (EC-09).
        await expect(acceptInvitePage.heading).toBeVisible();
    });

    test('never sends a token that is not token-shaped', async ({
        page,
        acceptInvitePage
    }) => {
        // Reserved characters cannot be in a real token (64 hex characters),
        // so such a link is incomplete by definition and is never put in a
        // URL. The gateway's own escaping is pinned by its unit spec
        // (EC-07, EC-11).
        const urls: string[] = [];
        await page.route('**/api/auth/invite/*', async (route) => {
            urls.push(route.request().url());
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(DEFAULT_INVITE)
            });
        });

        await acceptInvitePage.goto(`${'a'.repeat(200)}%#&/?`);

        await expect(acceptInvitePage.incompleteHeading()).toBeVisible();
        expect(urls).toHaveLength(0);
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
