import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the home page at `/` (the post-login landing). */
export class HomePage extends BasePage {
    /**
     * The page's `<h1>` — the time-of-day greeting (`Good …, {email}`). Matched
     * by level rather than text, since the greeting varies by hour and user.
     */
    readonly heading: Locator;
    /**
     * The authenticated shell's primary nav (from `@ortha-cms/shell-admin`'s
     * `AppShell` toolbar). Present only when a private route renders inside the
     * shell, so it doubles as proof the gated layout wrapped the page.
     */
    readonly nav: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { level: 1 });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
    }

    async goto() {
        await this.page.goto('/');
    }

    /**
     * The branded root loader (`AppLoader`) — a `role="status"` region shown
     * while the auth probe (`GET /api/auth/me`) is still resolving, before the
     * gated shell renders. Seed it with `mockSignedIn(page, {}, { delayMs })`.
     */
    rootLoader(): Locator {
        return this.page.getByRole('status').filter({ hasText: /Loading/ });
    }
}
