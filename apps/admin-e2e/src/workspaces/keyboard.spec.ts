import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces, mockWorkspacesApi } from '../support/api/workspaces';

/**
 * Keyboard operability of the Workspaces page and its create wizard — the part
 * axe can't check. Avoids asserting the exact global tab order (it runs through
 * the shell nav and varies); instead it pins the properties that matter: each
 * control is focusable and activates by keyboard, and the filter chips move
 * with the arrow keys.
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

    test('a row opens on Enter', async ({ page, workspacesPage }) => {
        await workspacesPage.goto();

        await workspacesPage.openButton('Marketing site').focus();
        await expect(workspacesPage.openButton('Marketing site')).toBeFocused();
        await page.keyboard.press('Enter');

        // Opening a workspace lands on its first section (Content Library).
        await expect(page).toHaveURL('/workspaces/ws_marketing/content');
    });

    test('the status filter chips move with arrow keys', async ({
        page,
        workspacesPage
    }) => {
        await workspacesPage.goto();

        // Roving tabindex: the selected chip (Active, the default) is the
        // group's single tab stop. ArrowRight moves focus along the horizontal
        // segmented control; Enter activates the focused chip.
        const active = workspacesPage.statusOption('Active');
        await active.focus();
        await expect(active).toBeFocused();

        await page.keyboard.press('ArrowRight');
        const archived = workspacesPage.statusOption('Archived');
        await expect(archived).toBeFocused();
        await page.keyboard.press('Enter');

        await expect(archived).toHaveAttribute('aria-checked', 'true');
        await expect(workspacesPage.card('Research archive')).toBeVisible();
    });

    test.describe('create wizard', () => {
        test.beforeEach(async ({ page }) => {
            await mockWorkspacesApi(page);
        });

        test('opens the wizard from the list on Enter', async ({
            page,
            workspacesPage,
            createWorkspacePage
        }) => {
            await workspacesPage.goto();

            await workspacesPage.newWorkspaceButton.focus();
            await expect(workspacesPage.newWorkspaceButton).toBeFocused();
            await page.keyboard.press('Enter');

            await expect(page).toHaveURL(/\/workspaces\/new$/);
            await expect(createWorkspacePage.heading).toBeVisible();
        });

        test('a color swatch is selectable by keyboard', async ({
            page,
            createWorkspacePage
        }) => {
            await createWorkspacePage.goto();

            // slate is the default selection; focus another swatch and activate
            // it from the keyboard.
            const green = createWorkspacePage.colorSwatch('green');
            await green.focus();
            await expect(green).toBeFocused();

            await page.keyboard.press('Space');

            await expect(green).toHaveAttribute('aria-checked', 'true');
            await expect(
                createWorkspacePage.colorSwatch('slate')
            ).toHaveAttribute('aria-checked', 'false');
        });
    });
});
