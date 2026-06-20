import { test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail
} from '../support/api/content';
import { expectNoA11yViolations } from '../support/a11y';

/**
 * Accessibility scans (axe, WCAG 2.1 A/AA) of the Content Library and its
 * dynamic states — the sidebar + welcome pane, an expanded group with a selected
 * type, and the open search palette. A regression guard, not a conformance claim.
 */
test.describe('Content Library accessibility (axe, WCAG 2.1 A/AA)', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
    });

    test('sidebar + welcome pane', async ({ contentLibraryPage, makeAxe }) => {
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);
        await contentLibraryPage.group('Collections').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('expanded group + selected type', async ({
        contentLibraryPage,
        makeAxe
    }) => {
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);
        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await contentLibraryPage.viewHeading('Blog posts').waitFor();
        // Scan the real records table (selection checkboxes), not a stub.
        await contentLibraryPage.recordsTable('Blog posts').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('column picker — open', async ({ contentLibraryPage, makeAxe }) => {
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);
        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await contentLibraryPage.recordsTable('Blog posts').waitFor();
        // The picker holds the column toggles + drag handles; scan that surface.
        await contentLibraryPage.columnsButton.click();
        await contentLibraryPage.columnOption('Title').waitFor();
        await expectNoA11yViolations(makeAxe());
    });

    test('search palette — open', async ({ contentLibraryPage, makeAxe }) => {
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);
        await contentLibraryPage.openSearch();
        await expectNoA11yViolations(makeAxe());
    });
});
