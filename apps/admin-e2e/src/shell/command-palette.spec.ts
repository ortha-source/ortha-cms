import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockMembers } from '../support/api/members';
import { mockEmptyActivity } from '../support/api/userDetail';

/**
 * The global command palette (`SidebarSearch`, from `@ortha-cms/shell-admin`):
 * the sidebar's search trigger opens a ⌘K `CommandDialog` whose suggestions are
 * the primary-nav destinations (from `SIDEBAR_NAV_SLOT`). Choosing one
 * navigates there. Only mounted in the global sidebar.
 */
test.describe('Command palette', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page, {
            id: 'u_amara',
            name: 'Amara Okafor',
            email: 'amara@ortha.dev'
        });
        await mockWorkspaces(page);
        await mockMembers(page);
        await mockEmptyActivity(page);
    });

    test('suggests the primary-nav destinations', async ({ homePage }) => {
        await homePage.goto();
        await homePage.openCommandPalette();

        await expect(homePage.commandItem('Home')).toBeVisible();
        await expect(homePage.commandItem('Workspaces')).toBeVisible();
        await expect(homePage.commandItem('Members')).toBeVisible();
        await expect(homePage.commandItem('Activity')).toBeVisible();
    });

    test('filters and navigates to the chosen destination', async ({
        homePage,
        page
    }) => {
        await homePage.goto();
        await homePage.openCommandPalette();

        await homePage.commandInput().fill('member');
        await homePage.commandItem('Members').click();

        await expect(page).toHaveURL(/\/users$/);
    });
});
