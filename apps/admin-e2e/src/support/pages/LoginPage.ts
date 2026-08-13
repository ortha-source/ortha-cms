import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the sign-in screen at `/identity/signin`. Owns every selector
 * the login suite needs, so specs assert behavior without touching the DOM.
 */
export class LoginPage extends BasePage {
    readonly heading: Locator;
    readonly email: Locator;
    readonly password: Locator;
    readonly submit: Locator;
    /**
     * The credential-error banner. Both this banner and field errors render
     * `role="alert"`, so it is anchored on the banner's constant title rather
     * than the bare role.
     */
    readonly errorBanner: Locator;
    /**
     * The heading the auth error boundary shows when a lazily-loaded auth screen
     * fails to arrive — a chunk request that 404s after a deploy, which
     * `Suspense` cannot recover from on its own.
     */
    readonly chunkErrorHeading: Locator;
    /** The error boundary's recovery action — a full reload fetches the new build. */
    readonly chunkErrorReload: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { name: 'Welcome back' });
        this.chunkErrorHeading = page.getByRole('heading', {
            name: /didn’t finish loading/
        });
        this.chunkErrorReload = page.getByRole('button', {
            name: 'Reload the page'
        });
        this.email = page.getByLabel('Email');
        this.password = page.getByLabel('Password');
        // The button's accessible name flips to "Signing in…" while submitting,
        // so match either state to keep one stable handle to the submit control.
        this.submit = page.getByRole('button', { name: /Login|Signing in/ });
        this.errorBanner = page
            .getByRole('alert')
            .filter({ hasText: 'Authentication failed' });
    }

    async goto() {
        await this.page.goto('/identity/signin');
    }

    /** Fill both fields and submit the form. */
    async login(email: string, password: string) {
        await this.email.fill(email);
        await this.password.fill(password);
        await this.submit.click();
    }

    /** A field-level validation message (e.g. "Email is required"). */
    fieldError(message: string): Locator {
        return this.page.getByText(message, { exact: true });
    }

    /**
     * A field's whole validation region — the `role="alert"` the input points
     * at with `aria-describedby`. Assert its *text* to pin how many messages a
     * field is announcing at once: several stacked messages render as a list
     * inside this one region, so counting a single message's occurrences can't
     * see them.
     */
    fieldErrorRegion(field: 'email' | 'password'): Locator {
        return this.page.locator(`#login-${field}-error`);
    }
}
