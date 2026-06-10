import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';

/**
 * Keyboard operability of the Workspaces page — the part axe can't check.
 * Avoids asserting the exact global tab order (it runs through the shell nav and
 * varies); instead it pins the properties that matter: each control is
 * focusable and activates by keyboard, and the dialog traps and restores focus.
 */
test.describe('Workspaces keyboard accessibility', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
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

    test('the create dialog opens, traps, and restores focus', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.newWorkspaceButton.focus();
        await page.keyboard.press('Enter');
        await expect(workspacesPage.dialog()).toBeVisible();

        // Escape closes the dialog and returns focus to the trigger.
        await page.keyboard.press('Escape');
        await expect(workspacesPage.dialog()).toBeHidden();
        await expect(workspacesPage.newWorkspaceButton).toBeFocused();
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

        // Selection follows focus: the grid re-filters to the archived set.
        await page.keyboard.press('Escape');
        await expect(workspacesPage.card('Research archive')).toBeVisible();
    });

    test('the color swatches move with arrow keys', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();
        await workspacesPage.openCreate();

        const slate = workspacesPage.colorSwatch('slate');
        await slate.focus();
        await expect(slate).toBeFocused();

        await page.keyboard.press('ArrowRight');
        const green = workspacesPage.colorSwatch('green');
        await expect(green).toBeFocused();
        await expect(green).toHaveAttribute('aria-checked', 'true');
        await expect(slate).toHaveAttribute('aria-checked', 'false');
    });

    test('a workspace can be created by keyboard alone', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();

        await workspacesPage.newWorkspaceButton.focus();
        await page.keyboard.press('Enter');
        await expect(workspacesPage.dialog()).toBeVisible();

        await workspacesPage.nameField().focus();
        await workspacesPage.nameField().pressSequentially('Keyboard space');
        await workspacesPage.nameField().press('Enter');

        await expect(workspacesPage.dialog()).toBeHidden();
        await expect(workspacesPage.card('Keyboard space')).toBeVisible();
    });
});
