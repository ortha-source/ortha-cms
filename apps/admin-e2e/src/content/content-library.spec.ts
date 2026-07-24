import { test, expect } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import {
    LIBRARY_WORKSPACE,
    SCOPED_WORKSPACE,
    UNGRANTED_WORKSPACE,
    mockContentSchema,
    mockContentSchemaDetail,
    mockContentEntries,
    mockContentEntryWrites,
    spyEntrySave
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
        await mockContentEntries(page);
        await mockContentEntryWrites(page);
    });

    test('renders the sidebar with the Workspace Content section', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await expect(contentLibraryPage.sidebar).toBeVisible();
        await expect(
            contentLibraryPage.sectionLabel('Workspace Content')
        ).toBeVisible();
        await expect(contentLibraryPage.group('Collections')).toBeVisible();
        await expect(contentLibraryPage.group('Pages')).toBeVisible();
        // No favorites pinned yet → the Favorites section is absent.
        await expect(contentLibraryPage.sectionLabel('Favorites')).toHaveCount(
            0
        );
    });

    test('Collections opens by default; Pages toggles on click', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        // Collections is open by default, so its rows show without interaction.
        await expect(contentLibraryPage.typeLink('Blog posts')).toBeVisible();
        await expect(contentLibraryPage.typeLink('Products')).toBeVisible();

        // Pages starts collapsed — its rows are hidden until expanded.
        await expect(contentLibraryPage.typeLink('Home')).toBeHidden();
        await contentLibraryPage.expandGroup('Pages');
        await expect(contentLibraryPage.typeLink('Home')).toBeVisible();
        await expect(contentLibraryPage.typeLink('About')).toBeVisible();

        // Clicking an open group collapses it again.
        await contentLibraryPage.group('Pages').click();
        await expect(contentLibraryPage.typeLink('Home')).toBeHidden();
    });

    test('selecting a single (page) opens its entry editor', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Pages');
        await contentLibraryPage.typeLink('Home').click();

        await expect(contentLibraryPage.viewHeading('Home')).toBeVisible();
        // A single opens straight into its one-entry editor (its Save action).
        await expect(contentLibraryPage.editorSave).toBeVisible();
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

    test('the column picker toggles a column', async ({
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
    });

    test('the column picker can be searched', async ({
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
        await contentLibraryPage.columnsButton.click();

        // Everything is listed until a query narrows it.
        await expect(contentLibraryPage.columnOption('Title')).toBeVisible();
        await expect(contentLibraryPage.columnOption('Excerpt')).toBeVisible();

        await contentLibraryPage.columnSearch.fill('exc');
        await expect(contentLibraryPage.columnOption('Excerpt')).toBeVisible();
        await expect(contentLibraryPage.columnOption('Title')).toBeHidden();

        // A hidden column found by search is still toggleable.
        await contentLibraryPage.columnOption('Excerpt').click();
        await page.keyboard.press('Escape');
        await expect(
            contentLibraryPage.columnHeader('Blog posts', 'Excerpt')
        ).toBeVisible();

        // Reopening starts from the full list, not the previous search.
        await contentLibraryPage.columnsButton.click();
        await expect(contentLibraryPage.columnSearch).toHaveValue('');
        await expect(contentLibraryPage.columnOption('Title')).toBeVisible();
    });

    test('the column search shows an empty state when nothing matches', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await contentLibraryPage.columnsButton.click();
        await contentLibraryPage.columnSearch.fill('zzzz');

        await expect(contentLibraryPage.columnSearchEmpty).toBeVisible();
        await expect(contentLibraryPage.columnOption('Title')).toBeHidden();
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

        // Add record → the create-entry editor (title "New Blog posts").
        await contentLibraryPage.addRecord.click();
        await expect(page).toHaveURL(/\/content\/blog_post\/new$/);
        await expect(
            contentLibraryPage.viewHeading('New Blog posts')
        ).toBeVisible();

        // Back to the table, then a row → the entry editor for that row.
        await page.goBack();
        await contentLibraryPage.recordRows('Blog posts').first().click();
        await expect(page).toHaveURL(/\/content\/blog_post\/[^/]+$/);
        await expect(contentLibraryPage.editorBackLink).toBeVisible();
    });

    test('saving a record stays on the editor and shows a success toast', async ({
        page,
        contentLibraryPage
    }) => {
        await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
        const spy = await spyEntrySave(page);
        await contentLibraryPage.goto(LIBRARY_WORKSPACE.id);

        await contentLibraryPage.expandGroup('Collections');
        await contentLibraryPage.typeLink('Blog posts').click();
        await contentLibraryPage.recordRows('Blog posts').first().click();
        await expect(page).toHaveURL(/\/content\/blog_post\/[^/]+$/);

        // Edit the title, then Save as a draft.
        await contentLibraryPage.fieldTextbox('Title').fill('Edited title');
        await contentLibraryPage.saveDraft();
        await expect.poll(() => spy.bodies.length).toBeGreaterThan(0);

        // The save keeps the user on the record's editor (no bounce to the
        // records list) and surfaces success via a toast.
        await expect(page).toHaveURL(/\/content\/blog_post\/[^/]+$/);
        await expect(contentLibraryPage.savedToast).toBeVisible();
    });

    test('reorders a column via the keyboard', async ({
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
            'Updated',
            'Actions'
        ];
        await expect(contentLibraryPage.columnHeaders('Blog posts')).toHaveText(
            expectedBefore
        );

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
            'Updated',
            'Actions'
        ];
        await expect(contentLibraryPage.columnHeaders('Blog posts')).toHaveText(
            expectedAfter
        );
    });

    test('sorts records by a column, toggling asc → desc → off', async ({
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

        // Title is the first data column, so its cells are `<td>` 2 (the leading
        // selection checkbox is `<td>` 1).
        const titleCells = contentLibraryPage.recordColumnCells(
            'Blog posts',
            2
        );
        const titleHeader = contentLibraryPage.columnHeader(
            'Blog posts',
            'Title'
        );

        // First click → ascending. URL + aria-sort reflect it, and the rendered
        // page is in non-decreasing order.
        await contentLibraryPage.sortHeader('Title').click();
        await expect(page).toHaveURL(/[?&]sort=title(&|$)/);
        await expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
        const asc = await titleCells.allTextContents();
        expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)));

        // Second click → descending (the reverse order; `-` prefix).
        await contentLibraryPage.sortHeader('Title').click();
        await expect(page).toHaveURL(/[?&]sort=-title(&|$)/);
        await expect(titleHeader).toHaveAttribute('aria-sort', 'descending');
        const desc = await titleCells.allTextContents();
        expect(desc).toEqual([...desc].sort((a, b) => b.localeCompare(a)));

        // Third click clears the sort.
        await contentLibraryPage.sortHeader('Title').click();
        await expect(page).not.toHaveURL(/[?&]sort=/);
        await expect(titleHeader).toHaveAttribute('aria-sort', 'none');
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
        await expect(contentLibraryPage.selectionCount).toHaveText(
            '1 selected'
        );
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

    test('row actions menu offers Edit, Publish, and Copy ID', async ({
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

        // Opening the actions menu must not navigate the row.
        await contentLibraryPage.rowActions('Blog posts', 0).click();
        await expect(page).toHaveURL(/\/content\/blog_post$/);

        await expect(contentLibraryPage.actionItem('Edit')).toBeVisible();
        // Blog posts is publishable → a Publish/Unpublish item is present.
        await expect(
            contentLibraryPage.actionItem(/Publish|Unpublish/)
        ).toBeVisible();
        await expect(contentLibraryPage.actionItem('Copy ID')).toBeVisible();
    });

    /**
     * The entry form's two "the button does nothing" failures (#28, #10): a
     * `number`/`money` control handing its raw *string* to the validation kernel
     * (which demands a real `number`), and a submit the client rules refuse
     * passing silently — no request, no message, an apparently dead button.
     */
    test.describe('entry form validation', () => {
        test('a numeric field accepts a number and sends it as one', async ({
            page,
            contentLibraryPage
        }) => {
            await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
            const spy = await spyEntrySave(page);
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'product'
            );

            await contentLibraryPage.fieldTextbox('Name').fill('QA widget');
            await contentLibraryPage.fieldSpinbutton('Price').fill('19.99');

            // A valid entry must not read back as invalid.
            await expect(
                contentLibraryPage.fieldError('Must be a number')
            ).toHaveCount(0);

            await contentLibraryPage.editorSave.click();
            await expect.poll(() => spy.bodies.length).toBeGreaterThan(0);
            // The wire value is a JSON number — a string here is what made the
            // kernel reject every numeric field.
            expect(spy.bodies[0].values.price).toBe(19.99);
        });

        test('clearing a numeric field sends nothing rather than NaN', async ({
            page,
            contentLibraryPage
        }) => {
            await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
            const spy = await spyEntrySave(page);
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'blog_post'
            );

            // `blog_post.price` is optional: typed, then emptied again.
            await contentLibraryPage.fieldTextbox('Title').fill('QA post');
            await contentLibraryPage.fieldSpinbutton('Price').fill('5');
            await contentLibraryPage.fieldSpinbutton('Price').fill('');

            await contentLibraryPage.saveDraft();
            await expect.poll(() => spy.bodies.length).toBeGreaterThan(0);
            expect(spy.bodies[0].values.price ?? null).toBeNull();
        });

        test('a blocked publish explains itself instead of doing nothing', async ({
            page,
            contentLibraryPage
        }) => {
            await mockWorkspaces(page, [LIBRARY_WORKSPACE]);
            const spy = await spyEntrySave(page);
            await contentLibraryPage.gotoNewEntry(
                LIBRARY_WORKSPACE.id,
                'product'
            );

            // Both fields are required and empty — publishing can't proceed.
            await contentLibraryPage.editorSave.click();

            await expect(
                contentLibraryPage.toast(/Can’t publish/)
            ).toBeVisible();
            // …and it names how much is wrong and where to start.
            await expect(
                contentLibraryPage.toast(/2 fields need attention/)
            ).toBeVisible();
            await expect(contentLibraryPage.toast(/“Name”/)).toBeVisible();
            // Refused client-side: the API is never called.
            expect(spy.bodies).toHaveLength(0);
        });
    });
});
