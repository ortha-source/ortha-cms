import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the placeholder home page at `/` (the post-login landing). */
export class HomePage extends BasePage {
    readonly heading: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', { name: 'Ortha CMS' });
    }

    async goto() {
        await this.page.goto('/');
    }
}
