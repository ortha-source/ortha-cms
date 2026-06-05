import { test, expect } from '../support/fixtures';
import { mockLogin, spyLogin } from '../support/api/auth';

const EMAIL = 'admin@example.com';
const PASSWORD = 'SecurePass123!';

/**
 * The login flow at `/identity/signin`. The backend is mocked at the network
 * layer (`support/api/auth`), so these assert admin behavior in isolation:
 * navigation on success, the error banner on a 401, client-side validation,
 * and the pending state. The real round-trip is the server-e2e suite's job.
 */
test.describe('Login page (/identity/signin)', () => {
    test.beforeEach(async ({ loginPage }) => {
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

        // Regression guard for the duplicate-error bug (onChange + onSubmit
        // both validating) we fixed while wiring login.
        test('shows exactly one error per field', async ({ loginPage }) => {
            await loginPage.submit.click();
            await expect(loginPage.fieldError('Email is required')).toHaveCount(
                1
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
