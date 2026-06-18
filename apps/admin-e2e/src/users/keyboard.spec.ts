import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers, spyInvite } from '../support/api/members';

/**
 * Keyboard operability for the Members page — what axe can't assert: the
 * search box takes focus and typing filters, the invite wizard opens from the
 * keyboard, and the row menu is keyboard-reachable.
 */
test.describe('Members keyboard operability', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
    });

    test('search filters as you type', async ({ membersPage }) => {
        await membersPage.goto();
        await membersPage.search.focus();
        await membersPage.search.pressSequentially('grace');

        await expect(membersPage.row('Grace Hopper')).toBeVisible();
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);
    });

    test('the invite wizard opens from the keyboard', async ({
        membersPage,
        page
    }) => {
        await spyInvite(page);
        await membersPage.goto();

        await membersPage.inviteButton.focus();
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL(/\/users\/invite$/);
        await expect(membersPage.inviteHeading()).toBeVisible();
    });

    test('the row menu opens from the keyboard', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.actionsTrigger('Grace Hopper').focus();
        await page.keyboard.press('Enter');

        await expect(membersPage.menuItem('General')).toBeVisible();
    });
});
