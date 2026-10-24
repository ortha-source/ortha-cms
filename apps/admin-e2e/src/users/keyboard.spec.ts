import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers, spyInviteMany } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';

/**
 * Keyboard operability for the Members page — what axe can't assert: the
 * search box takes focus and typing filters, the invite sheet works from the
 * keyboard, the quick filters toggle, and the row menu is keyboard-reachable.
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

    test('the invite sheet works from the keyboard alone', async ({
        membersPage,
        page
    }) => {
        await mockWorkspaces(page);
        const invite = await spyInviteMany(page);
        await membersPage.goto();

        await membersPage.inviteButton.focus();
        await page.keyboard.press('Enter');

        await expect(page).toHaveURL(/\/users\/invite$/);
        await expect(membersPage.inviteSheet()).toBeVisible();

        // Each address becomes a chip on Enter; Backspace in the empty box
        // takes the last one back.
        await membersPage.inviteEmails().focus();
        await page.keyboard.type('lena@growth.io');
        await page.keyboard.press('Enter');
        await page.keyboard.type('oops@growth.io');
        await page.keyboard.press('Enter');
        await expect(membersPage.emailChip('oops@growth.io')).toBeVisible();
        await page.keyboard.press('Backspace');
        await expect(membersPage.emailChip('oops@growth.io')).toHaveCount(0);
        await expect(membersPage.emailChip('lena@growth.io')).toBeVisible();

        await membersPage.sendInvites().focus();
        await page.keyboard.press('Enter');
        await expect(membersPage.inviteSentHeading()).toBeVisible();
        expect(invite.bodies[0].emails).toEqual(['lena@growth.io']);
    });

    test('the quick filters toggle from the keyboard', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.quickFilter('Disabled').focus();
        await page.keyboard.press('Enter');

        await expect(membersPage.quickFilter('Disabled')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(membersPage.row('Katherine Johnson')).toBeVisible();
        await expect(membersPage.row('Ada Lovelace')).toHaveCount(0);
    });

    test('the row menu opens from the keyboard', async ({
        membersPage,
        page
    }) => {
        await membersPage.goto();
        await membersPage.actionsTrigger('Grace Hopper').focus();
        await page.keyboard.press('Enter');

        await expect(membersPage.menuItem('Open profile')).toBeVisible();
    });
});
