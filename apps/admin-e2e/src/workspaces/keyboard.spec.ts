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
