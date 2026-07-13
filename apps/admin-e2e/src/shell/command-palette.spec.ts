import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockMembers } from '../support/api/members';
import { mockEmptyActivity } from '../support/api/userDetail';
import { mockContentSchema } from '../support/api/content';

/**
 * The global command palette (`SidebarSearch`, from `@ortha-cms/shell-admin`):
 * the sidebar's search trigger opens a ⌘K `CommandDialog`. Its suggestions are
 * the primary-nav destinations (`SIDEBAR_NAV_SLOT`) plus plugin-contributed
 * groups via `COMMAND_SLOT` — active workspaces (`workspaces-admin`) and each
 * workspace's content types (`content-admin`). Choosing one navigates there.
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
        await mockContentSchema(page);
    });

    test('suggests nav destinations, workspaces, and content types', async ({
        homePage
    }) => {
        await homePage.goto();
        await homePage.openCommandPalette();

        // Nav destinations.
        await expect(homePage.commandItem('Members')).toBeVisible();
        // A workspace (Marketing site is active).
        await expect(homePage.commandItem('Marketing site')).toBeVisible();
        // A content type of that workspace (label + workspace name).
        await expect(
            homePage.commandItem('Blog posts Marketing site')
        ).toBeVisible();
    });

    test('navigates to a nav destination', async ({ homePage, page }) => {
        await homePage.goto();
        await homePage.openCommandPalette();

        await homePage.commandInput().fill('member');
        await homePage.commandItem('Members').click();

        await expect(page).toHaveURL(/\/users$/);
    });

    test('jumps straight to a workspace content type', async ({
        homePage,
        page
    }) => {
        await homePage.goto();
        await homePage.openCommandPalette();

        await homePage.commandInput().fill('blog');
        await homePage.commandItem('Blog posts Marketing site').click();

        await expect(page).toHaveURL(/\/workspaces\/ws_marketing\/content\/blog_post$/);
    });
});
