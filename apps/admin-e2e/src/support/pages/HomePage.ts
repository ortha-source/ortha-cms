import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the placeholder home page at `/` (the post-login landing). */
export class HomePage extends BasePage {
    readonly heading: Locator;
    /**
     * The authenticated shell's primary nav (from `@ortha-cms/shell-admin`'s
     * `AppShell`). Present only when a private route renders inside the shell, so
     * it doubles as proof the gated layout wrapped the page.
     */
    readonly nav: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { name: 'Ortha CMS' });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
    }

    async goto() {
        await this.page.goto('/');
    }
}
