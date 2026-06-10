import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Workspaces page and its
 * dynamic states — the grid, the open popovers, the create dialog, the empty
 * state, and the archived (dimmed) view, where contrast issues tend to hide.
 * A regression guard, not a conformance claim.
 */
test.describe('Workspaces accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
    });

    test('grid — initial (active)', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('grid — all statuses (archived cards visible)', async ({
        workspacesPage,
        makeAxe
    }) => {
        await workspacesPage.goto();
        await workspacesPage.filterByStatus('All');
        await workspacesPage.card('Research archive').waitFor();
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

    test('create dialog — open', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await workspacesPage.openCreate();
        await expectNoA11yViolations(makeAxe());
    });

    test('create dialog — name validation error visible', async ({
        workspacesPage,
        makeAxe
    }) => {
        await workspacesPage.goto();
        await workspacesPage.openCreate();
        await workspacesPage.nameField().fill('Temp');
        await workspacesPage.nameField().fill('');
        await workspacesPage.fieldError('Name is required').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — no matches', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await workspacesPage.search.fill('nonexistent-workspace-xyz');
        await workspacesPage.emptyText('No workspaces match').waitFor();
        await expectNoA11yViolations(makeAxe());
    });
});
