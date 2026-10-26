import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers, DEFAULT_MEMBERS } from '../support/api/members';
import { mockWorkspaces } from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';
import { mockMemberPage, mockUserDetail } from '../support/api/userDetail';

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Members page and its dynamic
 * states — the table, the invite page, a quick filter, the row menu (with
 * its inline guard reasons), the member page, and the no-access state. A regression guard, not a conformance claim.
 */
test.describe('Members accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockMembers(page);
    });

    test('table — initial', async ({ membersPage, makeAxe }) => {
        await membersPage.goto();
        await membersPage.heading.waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('table — loading skeleton', async ({ membersPage, page, makeAxe }) => {
        // Hold the list response open so the table skeleton stays on screen
        // (the header + toolbar are already live) while axe scans it.
        await mockMembers(page, DEFAULT_MEMBERS, { delayMs: 30_000 });
        await membersPage.goto();
        await membersPage.tableSkeleton().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('invite page — form', async ({ membersPage, page, makeAxe }) => {
        await mockWorkspaces(page);
        await membersPage.goto();
        await membersPage.inviteButton.click();
        await membersPage.inviteWorkspace('Marketing site').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('quick filter applied', async ({ membersPage, makeAxe }) => {
        await membersPage.goto();
        await membersPage.quickFilter('Invited').click();
        await membersPage.row('alan@orthacms.dev').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('row menu — open', async ({ membersPage, makeAxe }) => {
        await membersPage.goto();
        await membersPage.openActions('Grace Hopper');
        await membersPage.menuItem('Open profile').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('row menu — guarded items with their reason', async ({
        membersPage,
        makeAxe
    }) => {
        await membersPage.goto();
        await membersPage.openActions('Ada Lovelace');
        await membersPage.menuReason(/last admin/).waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('member page — overview', async ({ page, makeAxe }) => {
        await mockWorkspaces(page);
        await mockMemberPage(page);
        await mockUserDetail(page);
        await page.goto('/users/u_grace');
        await page.getByRole('region', { name: 'Sign-in' }).waitFor();
        await page.getByText('2 active sessions').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — no matches', async ({ membersPage, makeAxe }) => {
        await membersPage.goto();
        await membersPage.search.fill('nobody-xyz');
        await membersPage.emptyText('No members match').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('no-access state', async ({ membersPage, makeAxe, page }) => {
        await mockSignedIn(page, { permissions: [] });
        await membersPage.goto();
        await membersPage.noAccessText().waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
