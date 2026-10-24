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
     * The banner for a failure that is not about what was typed — a throttled
     * attempt, a provider sign-in that did not complete, an outage. Both this
     * banner and field errors render `role="alert"`, so it is anchored on the
     * banner's constant title rather than the bare role.
     */
    readonly errorBanner: Locator;
    /**
     * The wrong-credentials answer, said under the password field (R7: errors
     * at the field). One message for an unknown address and a wrong password.
     */
    readonly credentialsError: Locator;
    /** "Forgot it?" on the password's label row. */
    readonly forgotPassword: Locator;
    /** The password field's show/hide toggle. */
    readonly revealPassword: Locator;
    /**
     * The standing explanation shown when this page was reached by a **forced**
     * sign-out — the session was revoked or expired and the app replaced the
     * page the visitor was on. Distinct from {@link errorBanner}: nothing they
     * did failed, so it is not the destructive submission banner.
     */
    readonly sessionEndedNotice: Locator;
    /**
     * The heading the auth error boundary shows when a lazily-loaded auth screen
     * fails to arrive — a chunk request that 404s after a deploy, which
     * `Suspense` cannot recover from on its own.
     */
    readonly chunkErrorHeading: Locator;
    /** The error boundary's recovery action — a full reload fetches the new build. */
    readonly chunkErrorReload: Locator;
    /**
     * The "or with email" divider between the single-sign-on links (which
     * lead) and the password form. Present only when the deployment registers
     * at least one provider, so it is also how a suite asserts the block is
     * absent.
     */
    readonly ssoSeparator: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Sign in',
            exact: true
        });
        this.chunkErrorHeading = page.getByRole('heading', {
            name: /didn’t finish loading/
        });
        this.chunkErrorReload = page.getByRole('button', {
            name: 'Reload the page'
        });
        this.email = page.getByLabel('Email', { exact: true });
        // Exact: the reveal toggle is named "Show password".
        this.password = page.getByLabel('Password', { exact: true });
        // The button's accessible name flips to "Signing in…" while submitting,
        // so match either state to keep one stable handle to the submit control.
        this.submit = page.getByRole('button', {
            name: /^(Sign in|Signing in…)$/
        });
        this.errorBanner = page
            .getByRole('alert')
            .filter({ hasText: 'Couldn’t sign you in' });
        this.credentialsError = page.locator('#login-password-error');
        this.forgotPassword = page.getByRole('link', { name: 'Forgot it?' });
        this.revealPassword = page.getByRole('button', {
            name: 'Show password'
        });
        this.sessionEndedNotice = page
            .getByRole('alert')
            .filter({ hasText: /Your session ended/ });
        this.ssoSeparator = page.getByText('or with email', { exact: true });
    }

    /**
     * One provider's sign-in control, by the label the operator configured.
     *
     * A **link**, not a button: signing in through a provider is a full-page
     * navigation, so an anchor is what it is — and asserting the role here is
     * what stops that from silently regressing into a scripted click.
     */
    ssoLink(label: string): Locator {
        return this.page.getByRole('link', { name: `Continue with ${label}` });
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
