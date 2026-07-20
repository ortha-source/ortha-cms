import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    mockWorkspaces,
    mockWorkspacesApi,
    WORKSPACES_SEED
} from '../support/api/workspaces';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Workspaces page and its
 * dynamic states — the table, the loading skeleton, the empty state, the
 * archived (muted) view, and the create wizard (including a visible validation
 * error), where contrast issues tend to hide. A regression guard, not a
 * conformance claim.
 */
test.describe('Workspaces accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('table — initial (active)', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('table — loading skeleton', async ({
        workspacesPage,
        page,
        makeAxe
    }) => {
        // Hold the list response open so the table skeleton stays on screen
        // (the header + toolbar are already live) while axe scans it.
        await mockWorkspaces(page, WORKSPACES_SEED, { delayMs: 30_000 });
        await workspacesPage.goto();
        await workspacesPage.listSkeleton().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('table — all statuses (archived rows visible)', async ({
        workspacesPage,
        makeAxe
    }) => {
        await workspacesPage.goto();
        await workspacesPage.filterByStatus('All');
        await workspacesPage.card('Research archive').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('empty state — no matches', async ({ workspacesPage, makeAxe }) => {
        await workspacesPage.goto();
        await workspacesPage.search.fill('nonexistent-workspace-xyz');
        await workspacesPage.emptyText('No workspaces match').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test.describe('create wizard', () => {
        test.beforeEach(async ({ page }) => {
            await mockWorkspacesApi(page);
        });

        test('basics step', async ({ createWorkspacePage, makeAxe }) => {
            await createWorkspacePage.goto();
            await expectNoA11yViolations(makeAxe());
        });

        test('basics step — slug validation error visible', async ({
            createWorkspacePage,
            makeAxe
        }) => {
            await createWorkspacePage.goto();
            await createWorkspacePage.slugInput.fill('Invalid Slug');
            await createWorkspacePage
                .fieldError('Use lowercase letters, numbers, and hyphens only.')
                .waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });
});
