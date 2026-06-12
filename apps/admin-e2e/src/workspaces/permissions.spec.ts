import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * The create-workspace affordances are gated on the `workspaces:create`
 * permission (resolved from `GET /api/auth/me`). The server enforces the same
 * permission; these specs assert the admin UI matches — the button is hidden and
 * the `/workspaces/new` route is unreachable for a user who lacks it.
 */
test.describe('Workspaces create permission', () => {
    test.beforeEach(async ({ page }) => {
        await mockWorkspaces(page);
    });

    test('shows "New workspace" to a user with workspaces:create', async ({
        page,
        workspacesPage
    }) => {
        // The default mocked user is an admin holding workspaces:create.
        await mockSignedIn(page);
        await workspacesPage.goto();

        await expect(workspacesPage.newWorkspaceButton).toBeVisible();
    });

    test('hides "New workspace" from a user without the permission', async ({
        page,
        workspacesPage
    }) => {
        await mockSignedIn(page, { permissions: ['workspaces:read'] });
        await workspacesPage.goto();

        await expect(workspacesPage.heading).toBeVisible();
        await expect(workspacesPage.newWorkspaceButton).toBeHidden();
    });

    test('redirects /workspaces/new to the list without the permission', async ({
        page,
        workspacesPage
    }) => {
        await mockSignedIn(page, { permissions: ['workspaces:read'] });

        await page.goto('/workspaces/new');

        await expect(page).toHaveURL(/\/workspaces$/);
        await expect(workspacesPage.heading).toBeVisible();
    });
});
