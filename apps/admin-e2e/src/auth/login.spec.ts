import { test, expect } from '../support/fixtures';
import {
    mockLogin,
    mockSignedIn,
    mockSignedOut,
    spyLogin,
    spySignedOut
} from '../support/api/auth';

const EMAIL = 'admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The login flow at `/identity/signin`. The backend is mocked at the network
 * layer (`support/api/auth`), so these assert admin behavior in isolation:
 * navigation on success, the error banner on a 401, client-side validation,
 * and the pending state. The real round-trip is the server-e2e suite's job.
 *
 * `beforeEach` seeds a signed-out session (`GET /auth/me` → 401) so the host's
 * auth probe is deterministic; the success cases flip to signed in before
 * submitting, so the post-login redirect to the private home page resolves.
 */
test.describe('Login page (/identity/signin)', () => {
    test.beforeEach(async ({ page, loginPage }) => {
        await mockSignedOut(page);
        await loginPage.goto();
        await expect(loginPage.heading).toBeVisible();
    });

    test.describe('successful sign-in', () => {
        test('navigates to the home page', async ({
            page,
            loginPage,
            homePage
        }) => {
            await mockLogin(page, { status: 201 });
            await mockSignedIn(page);
            await loginPage.login(EMAIL, PASSWORD);

            await expect(page).toHaveURL('/');
            await expect(homePage.heading).toBeVisible();
        });
    });

    test.describe('invalid credentials (401)', () => {
        test('shows the error banner and stays on the page', async ({
            page,
            loginPage
        }) => {
            await mockLogin(page, { status: 401 });
            await loginPage.login(EMAIL, 'wrong-password');

            await expect(loginPage.errorBanner).toContainText('incorrect');
            await expect(page).toHaveURL(/\/identity\/signin/);
        });
    });

    /**
     * ORT-201 — a throttled attempt says so.
     *
     * The route carries `ThrottlerGuard`, and everything that was not a 401
     * fell into "Something went wrong. Please try again" — advice that cannot
     * work, given to the one person it is aimed at: somebody who mistyped their
     * password a few times and is now locked out for a minute. Asserted from
     * the browser rather than as a unit, because what is under test is the
     * whole path — the header surviving axios, `ApiError` carrying it, and the
     * page choosing the sentence.
     */
    test.describe('rate limited (429)', () => {
        test('names the wait when the server sends Retry-After', async ({
            page,
            loginPage
        }) => {
            await mockLogin(page, { status: 429, retryAfterSeconds: 45 });
            await loginPage.login(EMAIL, 'wrong-password');

            await expect(loginPage.errorBanner).toContainText('45 seconds');
            // And is not the generic catch-all it used to be.
            await expect(loginPage.errorBanner).not.toContainText(
                'Something went wrong'
            );
            await expect(page).toHaveURL(/\/identity\/signin/);
        });

        test('still explains itself when the server names no wait', async ({
            page,
            loginPage
        }) => {
            await mockLogin(page, { status: 429 });
            await loginPage.login(EMAIL, 'wrong-password');

            // No invented countdown — a number the user watches expire and
            // finds still wrong is worse than no number.
            await expect(loginPage.errorBanner).toContainText('Too many');
            await expect(loginPage.errorBanner).not.toContainText('seconds');
        });

        test('says nothing about whether the account exists', async ({
            page,
            loginPage
        }) => {
            await mockLogin(page, { status: 429 });
            await loginPage.login('nobody@example.com', 'whatever');

            // The limit is keyed on the caller, not the identity claimed, so
            // the message must not drift into the enumeration signal the 401
            // copy is carefully written to avoid.
            await expect(loginPage.errorBanner).not.toContainText('incorrect');
            await expect(loginPage.errorBanner).not.toContainText('account');
        });
    });

    test.describe('client-side validation', () => {
        test('empty submit flags both required fields without calling the API', async ({
            page,
            loginPage
        }) => {
            const login = await spyLogin(page);
            await loginPage.submit.click();

            await expect(
                loginPage.fieldError('Email is required')
            ).toBeVisible();
            await expect(
                loginPage.fieldError('Password is required')
            ).toBeVisible();
            expect(login.count).toBe(0);
        });

        // Regression guard for two ways a field ends up announcing more than
        // one thing: the same validator running twice (onChange + onSubmit),
        // and two *different* rules both failing on an empty box — "required"
        // plus "that isn't a valid email". Asserting the region's whole text
        // catches both; counting one message's occurrences catches only the
        // first.
        test('shows exactly one error per field', async ({ loginPage }) => {
            await loginPage.submit.click();

            await expect(loginPage.fieldErrorRegion('email')).toHaveText(
                'Email is required'
            );
            await expect(loginPage.fieldErrorRegion('password')).toHaveText(
                'Password is required'
            );
        });

        test('rejects a malformed email', async ({ loginPage }) => {
            await loginPage.email.fill('not-an-email');
            await loginPage.password.fill(PASSWORD);
            await loginPage.submit.click();

            await expect(
                loginPage.fieldError('Enter a valid email address')
            ).toBeVisible();
        });
    });

    test.describe('the controls on offer', () => {
        // Password recovery, sign-up and the legal pages have no routes yet, so
        // the page must not advertise them: they used to render as buttons with
        // no handler, four focusable stops that did nothing when activated.
        test('offers no control that leads nowhere', async ({
            page,
            loginPage
        }) => {
            await expect(loginPage.submit).toBeVisible();

            for (const name of [
                'Forgot your password?',
                'Sign up',
                'Terms of Service',
                'Privacy Policy'
            ]) {
                await expect(page.getByRole('button', { name })).toHaveCount(0);
                await expect(page.getByRole('link', { name })).toHaveCount(0);
            }
        });

        test('says how an account is obtained instead', async ({
            page,
            loginPage
        }) => {
            await expect(loginPage.submit).toBeVisible();
            await expect(
                page.getByText(/Accounts are created by invitation/)
            ).toBeVisible();
        });
    });

    test.describe('pending state', () => {
        test('disables the submit button while the request is in flight', async ({
            page,
            loginPage
        }) => {
            await mockLogin(page, { status: 201, delayMs: 1000 });
            await loginPage.login(EMAIL, PASSWORD);

            await expect(loginPage.submit).toBeDisabled();
        });
    });
});

/**
 * The session probe behind the page, rather than the form on it: how often it
 * asks, and what a `401` means to it (nobody is signed in — an ordinary answer,
 * not an error worth retrying).
 */
test.describe('The session probe on the sign-in page', () => {
    test('asks once and does not retry the 401', async ({
        page,
        loginPage
    }) => {
        const probe = await spySignedOut(page);
        // Entering through a private route, not `/identity/signin` directly:
        // the sign-in page is public and sits outside `AuthProvider`, so it
        // probes nothing at all — the gate is what asks.
        await page.goto('/');
        await expect(loginPage.heading).toBeVisible();

        // Give a retry room to happen before asserting it didn't: the query is
        // `retry: false` precisely because "not signed in" is the answer, not a
        // failure.
        await page.waitForTimeout(1_500);
        expect(probe.count).toBe(1);
    });

    test('renders the form for an already signed-in visitor', async ({
        page,
        loginPage
    }) => {
        // Documented current behaviour, not an endorsement: the sign-in route is
        // public and does not bounce a live session away, so submitting here
        // opens a second server-side session. Pinned so a change to it is a
        // deliberate one (EC-13 on ORT-57).
        await mockSignedIn(page);
        await loginPage.goto();

        await expect(loginPage.heading).toBeVisible();
        await expect(loginPage.email).toBeEditable();
    });
});
