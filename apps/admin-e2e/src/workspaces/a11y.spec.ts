import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Workspaces page and its
 * dynamic states — the grid, the open popovers, and the empty state, where
 * contrast issues tend to hide. A regression guard, not a conformance claim.
 */
test.describe('Workspaces accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('grid — initial', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('status filter popover — open', async ({
        workspacesPage,
        makeAxe
    }) => {
        await workspacesPage.goto();
        await workspacesPage.openFilter();
        await workspacesPage.statusOption('Archived').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('member popover — open', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await workspacesPage.memberButton('Marketing site').click();
        await workspacesPage.memberName('Ada Lovelace').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — no matches', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await workspacesPage.search.fill('nonexistent-workspace-xyz');
        await workspacesPage.emptyText('No workspaces match').waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
