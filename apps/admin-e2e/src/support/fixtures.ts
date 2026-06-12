import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { WorkspacesPage } from './pages/WorkspacesPage';
import { CreateWorkspacePage } from './pages/CreateWorkspacePage';

interface Fixtures {
    loginPage: LoginPage;
    homePage: HomePage;
    workspacesPage: WorkspacesPage;
    createWorkspacePage: CreateWorkspacePage;
    /**
     * Factory for a fresh axe scanner scoped to the current page, pre-tagged for
     * WCAG 2.1 A/AA (the team's best-practice target). Call it per assertion so
     * each scan reflects the page's current state.
     */
    makeAxe: () => AxeBuilder;
}

/**
 * `test` extended with page-object + accessibility fixtures — import this (not
 * `@playwright/test`) in specs, so a spec never constructs a page object itself.
 */
export const test = base.extend<Fixtures>({
    loginPage: async ({ page }, use) => {
        await use(new LoginPage(page));
    },
    homePage: async ({ page }, use) => {
        await use(new HomePage(page));
    },
    workspacesPage: async ({ page }, use) => {
        await use(new WorkspacesPage(page));
    },
    createWorkspacePage: async ({ page }, use) => {
        await use(new CreateWorkspacePage(page));
    },
    makeAxe: async ({ page }, use) => {
        await use(() =>
            new AxeBuilder({ page }).withTags([
                'wcag2a',
                'wcag2aa',
                'wcag21a',
                'wcag21aa'
            ])
        );
    }
});

export { expect } from '@playwright/test';
