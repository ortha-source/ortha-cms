import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    SCOPED_WORKSPACE,
    UNGRANTED_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail
} from '../support/api/content';

/**
 * The Content Library at `/workspaces/:id/content` — the second-sidebar nav
 * (collapsible Collections/Pages, Favorites, Manage), the ⌘K search palette, the
 * selected-type pane, and per-workspace scoping. The API is mocked at the network
 * layer, so no backend is needed.
 */
test.describe('Content Library', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockContentSchema(page);
        await mockContentSchemaDetail(page);
    });

    test('renders the sidebar with Workspace and Manage sections', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await expect(contentLibraryPage.sidebar).toBeVisible();
        await expect(
            contentLibraryPage.sectionLabel('Workspace')
        ).toBeVisible();
        await expect(contentLibraryPage.group('Collections')).toBeVisible();
        await expect(contentLibraryPage.group('Pages')).toBeVisible();
        // Manage section with its two static links.
        await expect(contentLibraryPage.sectionLabel('Manage')).toBeVisible();
        await expect(contentLibraryPage.manageLink('History')).toBeVisible();
        await expect(contentLibraryPage.manageLink('Trash')).toBeVisible();
        // No favorites pinned yet → the Favorites section is absent.
        await expect(contentLibraryPage.sectionLabel('Favorites')).toHaveCount(
            0
        );
    });

    test('groups start collapsed and expand on click', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        // Collapsed by default — the type rows are hidden.
        await expect(contentLibraryPage.typeLink('Blog posts')).toBeHidden();
        await contentLibraryPage.expandGroup('Collections');
        await expect(contentLibraryPage.typeLink('Blog posts')).toBeVisible();
        await expect(contentLibraryPage.typeLink('Products')).toBeVisible();
    });

    test('selecting a single (page) shows its placeholder pane', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Pages');
        await contentLibraryPage.typeLink('Home').click();

        await expect(contentLibraryPage.viewHeading('Home')).toBeVisible();
        await expect(
            contentLibraryPage.paneText('Entries coming soon')
        ).toBeVisible();
        await expect(page).toHaveURL(/\/content\/home$/);
    });

    test('only shows content types granted to the workspace', async ({
        page,
        contentLibraryPage
    }) => {
        // Scoped workspace is granted blog_post + home only.
        await mockWorkspaces(page, [SCOPED_WORKSPACE]);
        await contentLibraryPage.goto(SCOPED_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.expandGroup('Pages');

        await expect(contentLibraryPage.typeLink('Blog posts')).toBeVisible();
        await expect(contentLibraryPage.typeLink('Home')).toBeVisible();
        // Ungranted types are filtered out.
        await expect(contentLibraryPage.typeLink('Products')).toHaveCount(0);
        await expect(contentLibraryPage.typeLink('About')).toHaveCount(0);
    });

    test('pinning a type adds it to a Favorites section', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.pinToggle('Blog posts').click();

        await expect(
            contentLibraryPage.sectionLabel('Favorites')
        ).toBeVisible();
        // The pinned row now also appears under Favorites (two matches total).
        await expect(contentLibraryPage.typeLink('Blog posts')).toHaveCount(2);
    });

    test('opens the search palette and navigates to a type', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.openSearch();
        await contentLibraryPage.searchInput.fill('Products');
        await contentLibraryPage.searchOption('Products').click();

        await expect(contentLibraryPage.searchDialog).toBeHidden();
        await expect(contentLibraryPage.viewHeading('Products')).toBeVisible();
        await expect(page).toHaveURL(/\/content\/product$/);
    });

    test('the Ctrl/⌘+K shortcut opens and Escape closes the palette', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.openSearchByShortcut();
        await expect(contentLibraryPage.searchInput).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(contentLibraryPage.searchDialog).toBeHidden();
    });

    test('shows the empty state when the workspace has no content', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [UNGRANTED_WORKSPACE]);
        await contentLibraryPage.goto(UNGRANTED_WORKSPACE.id);

        await expect(contentLibraryPage.emptyTitle).toBeVisible();
        await expect(contentLibraryPage.sidebar).toHaveCount(0);
    });

    test('shows the error state and recovers on retry', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await mockContentSchema(page, { status: 500 });
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        // TanStack Query retries (3×, exponential backoff) before surfacing the
        // error, so allow more than the default assertion timeout.
        await expect(contentLibraryPage.errorTitle).toBeVisible({
            timeout: 15_000
        });

        // Recover: the next fetch succeeds, and retry re-renders the sidebar.
        await mockContentSchema(page);
        await contentLibraryPage.retry.click();
        await expect(contentLibraryPage.sidebar).toBeVisible();
    });

    test('selecting a collection shows its records table', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();

        await expect(page).toHaveURL(/\/content\/blog_post$/);
        await expect(
            contentLibraryPage.viewHeading('Blog posts')
        ).toBeVisible();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();
        await expect(contentLibraryPage.addRecord).toBeVisible();
        // Default page size is 10; the seed has more rows than one page.
        await expect(contentLibraryPage.recordRows('Blog posts')).toHaveCount(
            10
        );
        // Default columns: the first four non-heavy fields + Status + Updated.
        await expect(
            contentLibraryPage.columnHeader('Blog posts', 'Title')
        ).toBeVisible();
        await expect(
            contentLibraryPage.columnHeader('Blog posts', 'Status')
        ).toBeVisible();
        // The richtext "Excerpt" field is heavy → hidden by default.
        await expect(
            contentLibraryPage.columnHeader('Blog posts', 'Excerpt')
        ).toHaveCount(0);
    });

    test('searching with no matches shows the empty state', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();

        await contentLibraryPage.recordsSearch.fill('zzz-no-such-record');
        await expect(contentLibraryPage.noRecordsMatch).toBeVisible();
        // The search is reflected in the URL (deep-linkable).
        await expect(page).toHaveURL(/[?&]q=zzz-no-such-record/);
    });

    test('the column picker toggles a column and persists it', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();

        // Reveal the heavy "Excerpt" column via the picker.
        await contentLibraryPage.columnsButton.click();
        await contentLibraryPage.columnOption('Excerpt').click();
        await page.keyboard.press('Escape');
        await expect(
            contentLibraryPage.columnHeader('Blog posts', 'Excerpt')
        ).toBeVisible();

        // The choice survives a reload (persisted per type in localStorage).
        await page.reload();
        await expect(
            contentLibraryPage.columnHeader('Blog posts', 'Excerpt')
        ).toBeVisible();
    });

    test('Add record and row click route to their stubs', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();

        // Add record → the create-entry stub.
        await contentLibraryPage.addRecord.click();
        await expect(page).toHaveURL(/\/content\/blog_post\/new$/);
        await expect(
            contentLibraryPage.paneText('Create entry')
        ).toBeVisible();

        // Back to the table, then a row → the entry-detail stub.
        await page.goBack();
        await contentLibraryPage.recordRows('Blog posts').first().click();
        await expect(page).toHaveURL(/\/content\/blog_post\/[^/]+$/);
        await expect(contentLibraryPage.paneText('Edit entry')).toBeVisible();
    });

    test('reorders a column via the keyboard and persists it', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();

        // Default order: a leading checkbox column (empty header text), then the
        // first four non-heavy fields + Status + Updated.
        const expectedBefore = [
            '',
            'Title',
            'Price',
            'Published',
            'Category',
            'Status',
            'Updated'
        ];
        await expect(
            contentLibraryPage.columnHeaders('Blog posts')
        ).toHaveText(expectedBefore);

        // Reordering lives in the column picker (a vertical list), so open it,
        // pick up "Title" with the keyboard, and move it one slot down — which is
        // one slot right in the table. dnd-kit schedules each keyboard move on an
        // animation frame, so let the drag start and the move settle between keys.
        await contentLibraryPage.columnsButton.click();
        await contentLibraryPage.reorderHandle('Title').focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        await page.keyboard.press('Space');
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');

        const expectedAfter = [
            '',
            'Price',
            'Title',
            'Published',
            'Category',
            'Status',
            'Updated'
        ];
        await expect(
            contentLibraryPage.columnHeaders('Blog posts')
        ).toHaveText(expectedAfter);

        // The new order survives a reload (persisted per type in localStorage).
        await page.reload();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();
        await expect(
            contentLibraryPage.columnHeaders('Blog posts')
        ).toHaveText(expectedAfter);
    });

    test('selects rows, select-all, and clears the selection', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await expect(
            contentLibraryPage.recordsTable('Blog posts')
        ).toBeVisible();

        // No selection bar until something is selected.
        await expect(contentLibraryPage.selectionCount).toHaveCount(0);

        // Selecting a row shows the bar; the checkbox click must not navigate.
        await contentLibraryPage.rowCheckbox('Blog posts', 0).click();
        await expect(contentLibraryPage.selectionCount).toHaveText('1 selected');
        await expect(page).toHaveURL(/\/content\/blog_post$/);

        // Select-all covers the whole page (default page size 10).
        await contentLibraryPage.selectAll.click();
        await expect(contentLibraryPage.selectionCount).toHaveText(
            '10 selected'
        );

        // Clear empties the selection and hides the bar.
        await contentLibraryPage.clearSelection.click();
        await expect(contentLibraryPage.selectionCount).toHaveCount(0);
    });
});
