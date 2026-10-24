import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for "Forgot it?" at `/identity/forgot-password` (from
 * `@orthacms/identity-admin`). Two faces, chosen by the deployment: the request
 * form and its "Check your email" confirmation when a mail provider is
 * configured (`mockPasswordRecoveryAvailability(page, true)`), or the "ask an
 * admin" card when none is.
 *
 * Constructed directly in its spec rather than through a fixture, so the
 * shared fixtures file is left alone.
 */
export class ForgotPasswordPage extends BasePage {
    /** The `<h1>` of the request form and of the no-mail card alike. */
    readonly heading: Locator;
    /** The address field (request form only). */
    readonly email: Locator;
    /** The request form's submit control. */
    readonly submit: Locator;
    /** The confirmation's heading. */
    readonly sentHeading: Locator;
    /** The no-mail card's explanation. */
    readonly noMailExplanation: Locator;
    /** Where an admin clicks, on the no-mail card. */
    readonly adminPath: Locator;
    /** The way back to the sign-in form. */
    readonly backToSignIn: Locator;
    /** The request's failure banner. */
    readonly errorBanner: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Forgot your password?'
        });
        this.email = page.getByLabel('Email', { exact: true });
        this.submit = page.getByRole('button', {
            name: /^(Send reset link|Sending…)$/
        });
        this.sentHeading = page.getByRole('heading', {
            name: 'Check your email'
        });
        this.noMailExplanation = page.getByText(
            /This server doesn’t send reset emails/
        );
        this.adminPath = page.getByText(
            /Members → your name → Sessions & access → Password reset link/
        );
        this.backToSignIn = page.getByRole('link', {
            name: 'Back to sign in'
        });
        this.errorBanner = page
            .getByRole('alert')
            .filter({ hasText: 'Couldn’t send the link' });
    }

    async goto() {
        await this.page.goto('/identity/forgot-password');
    }

    /** Ask for a link for `email`. */
    async request(email: string) {
        await this.email.fill(email);
        await this.submit.click();
    }
}
