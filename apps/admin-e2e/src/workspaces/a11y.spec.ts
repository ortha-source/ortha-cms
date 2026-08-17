import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import {
    manyWorkspaces,
    mockWorkspaceSettingsApi,
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

    test('sidebar quick-list — collapsed', async ({
        workspacesPage,
        makeAxe
    }) => {
        await workspacesPage.goto();
        await workspacesPage.collapseSidebarWorkspaces();
        await expectNoA11yViolations(makeAxe());
    });

    test('sidebar quick-list — empty but creatable', async ({
        page,
        workspacesPage,
        makeAxe
    }) => {
        // The state that took out sixteen scans across five suites, and that
        // every other case here missed: no workspaces, but create permission,
        // so the section still renders its heading and "+". Radix puts
        // `aria-controls` on an **open** trigger, and the group is open by
        // default, so a body that was conditionally not rendered left a
        // dangling idref — `aria-valid-attr-value`, critical, on every page
        // carrying the sidebar. Any suite whose mocks leave the workspace list
        // empty or pending (users, activity, the loading skeletons) lands here,
        // which is why it broke app-wide rather than only in this folder.
        await mockWorkspaces(page, []);
        await workspacesPage.goto();
        await expectNoA11yViolations(makeAxe());
    });

    test('sidebar quick-list — list still loading', async ({
        page,
        workspacesPage,
        makeAxe
    }) => {
        // Same shape, reached the other way: while the list query is in flight
        // there are no rows either, and this is the pending state the other
        // suites' scans sit in.
        await mockWorkspaces(page, WORKSPACES_SEED, { delayMs: 30_000 });
        await workspacesPage.goto();
        await workspacesPage.listSkeleton().waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('workspace switcher popover — a scrolling list of 30', async ({
        page,
        workspaceSettingsPage,
        makeAxe
    }) => {
        // The scroll container only exists once the list overflows, which is
        // also the only state in which `scrollable-region-focusable` can fire
        // (axe never emulates a viewport, so the overflow has to be real at the
        // default one). Its rows are <button>s, so the region is reachable —
        // this scan is what pins that.
        await mockWorkspaceSettingsApi(page, manyWorkspaces(30));
        await workspaceSettingsPage.goto('ws_many_1');
        await workspaceSettingsPage.openWorkspaceSwitcher();
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

        // The scan used to stop at the basics step, which is exactly why an
        // unlabelled search input on the members step — an axe-detectable
        // failure — shipped and survived. Every step the user can reach gets
        // scanned now.
        test('members step', async ({ createWorkspacePage, makeAxe }) => {
            await createWorkspacePage.goto();
            await createWorkspacePage.nameInput.fill('Scanned workspace');
            await createWorkspacePage.continueToMembers.click();
            await createWorkspacePage.memberSearch.waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('members step — directory results open', async ({
            createWorkspacePage,
            makeAxe
        }) => {
            await createWorkspacePage.goto();
            await createWorkspacePage.nameInput.fill('Scanned workspace');
            await createWorkspacePage.continueToMembers.click();
            await createWorkspacePage.memberSearch.fill('bar');
            await createWorkspacePage.memberOption('Barbara Liskov').waitFor();
            await expectNoA11yViolations(makeAxe());
        });

        test('content step', async ({ createWorkspacePage, makeAxe }) => {
            await createWorkspacePage.goto();
            await createWorkspacePage.nameInput.fill('Scanned workspace');
            await createWorkspacePage.continueToMembers.click();
            await createWorkspacePage.continueToContent.click();
            await createWorkspacePage.createButton.waitFor();
            await expectNoA11yViolations(makeAxe());
        });
    });
});
