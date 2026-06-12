import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * Keyboard operability of the Workspaces page — the part axe can't check.
 * Avoids asserting the exact global tab order (it runs through the shell nav and
 * varies); instead it pins the properties that matter: each control is
 * focusable and activates by keyboard.
 */
test.describe('Workspaces keyboard accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('search is reachable and filters by keyboard', async ({
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.search.focus();
        await expect(workspacesPage.search).toBeFocused();
        await workspacesPage.search.pressSequentially('Marketing');

        await expect(workspacesPage.card('Marketing site')).toBeVisible();
        await expect(workspacesPage.card('Support hub')).toBeHidden();
    });

    test('a card opens on Enter', async ({ page, workspacesPage }) => {
        await workspacesPage.goto();

        await workspacesPage.openButton('Marketing site').focus();
        await expect(workspacesPage.openButton('Marketing site')).toBeFocused();
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL('/');
    });

    test('the status filter radiogroup moves with arrow keys', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();
        await workspacesPage.openFilter();

        // Roving tabindex: the selected option (Active, the default) is the
        // group's single tab stop. Arrow keys then move selection *and* focus
        // together — the ARIA radiogroup pattern.
        const active = workspacesPage.statusOption('Active');
        await active.focus();
        await expect(active).toBeFocused();

        await page.keyboard.press('ArrowDown');
        const archived = workspacesPage.statusOption('Archived');
        await expect(archived).toBeFocused();
        await expect(archived).toHaveAttribute('aria-checked', 'true');

        // Selection follows focus: the grid re-filters to the archived set
        // (empty, since the read API has no archived workspaces).
        await page.keyboard.press('Escape');
        await expect(workspacesPage.card('Marketing site')).toBeHidden();
    });
});
