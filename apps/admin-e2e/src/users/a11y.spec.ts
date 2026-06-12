import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockMembers } from '../support/api/members';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Members page and its dynamic
 * states — the table, the open invite dialog and row menu, and the no-access
 * state. A regression guard, not a conformance claim.
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

    test('invite dialog — open', async ({ membersPage, makeAxe }) => {
        await membersPage.goto();
        await membersPage.inviteButton.click();
        await membersPage.dialogEmail().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('row menu — open', async ({ membersPage, makeAxe }) => {
        await membersPage.goto();
        await membersPage.openActions('Grace Hopper');
        await membersPage.menuItem('Edit').waitFor();
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
