import { test as base } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';

interface Pages {
    loginPage: LoginPage;
    homePage: HomePage;
}

/**
 * `test` extended with page-object fixtures — import this (not `@playwright/test`)
 * in specs, so a spec never constructs a page object itself.
 */
export const test = base.extend<Pages>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    homePage: async ({ page }, use) => {
        await use(new HomePage(page));
    }
});

export { expect } from '@playwright/test';
