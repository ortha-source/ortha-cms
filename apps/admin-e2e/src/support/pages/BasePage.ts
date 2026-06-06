import { type Page } from '@playwright/test';

/** Common base for all page objects: holds the Playwright `page`. */
export abstract class BasePage {
    constructor(protected readonly page: Page) {}
}
