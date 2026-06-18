import { test, expect } from '../support/fixtures';
import { mockSignedIn, spyLogout } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    mockEmptyActivity,
    mockUserDetail,
    mockUserSessions
} from '../support/api/userDetail';

/**
 * The toolbar account menu (`AccountMenu`, `@ortha-cms/users-admin`,
 * contributed to the shell's `NAVBAR_END_SLOT`): the signed-in user's avatar +
 * dropdown with their name/email, a link to their own profile, and Logout.
 * Signed in as Ada (a member in the roster) so "My profile" lands on a real
 * detail page.
 */
test.describe('Account menu', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page, {
            id: 'u_ada',
            name: 'Ada Lovelace',
            email: 'ada@ortha.dev'
        });
        await mockMembers(page);
        await mockWorkspaces(page);
        await mockEmptyActivity(page);
        await mockUserSessions(page);
        await mockUserDetail(page);
    });

    test('shows the signed-in account in the toolbar dropdown', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.openAccountMenu();

        await expect(membersPage.accountMenuItem('My profile')).toBeVisible();
        await expect(membersPage.accountMenuItem('Logout')).toBeVisible();
        await expect(page.getByText('ada@ortha.dev')).toBeVisible();
    });

    test('"My profile" opens the current user’s detail page', async ({
        membersPage,
        userDetailPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.openAccountMenu();
        await membersPage.accountMenuItem('My profile').click();

        await expect(page).toHaveURL(/\/users\/u_ada/);
        await expect(userDetailPage.heading('Ada Lovelace')).toBeVisible();
    });

    test('Logout calls the logout endpoint', async ({ membersPage, page }) => {
        const logout = await spyLogout(page);
        await membersPage.goto();
        await membersPage.openAccountMenu();
        await membersPage.accountMenuItem('Logout').click();

        await expect.poll(() => logout.count).toBe(1);
    });
});
