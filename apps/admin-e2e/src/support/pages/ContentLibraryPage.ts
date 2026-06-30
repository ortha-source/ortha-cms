import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Content Library at `/workspaces/:id/content` (from
 * `@ortha-cms/content-admin`) — the second-sidebar nav (collapsible Collections
 * and Pages groups, a Favorites section), the ⌘K search palette, and the
 * selected-type pane. Seed it with
 * `mockSignedIn`, `mockWorkspaces`, and `mockContentSchema`.
 */
export class ContentLibraryPage extends BasePage {
    /** The second sidebar nav region. */
    readonly sidebar: Locator;
    /** The sidebar's search trigger (opens the ⌘K palette). */
    readonly searchTrigger: Locator;
    /** The command palette dialog. */
    readonly searchDialog: Locator;
    /** The palette's search input. */
    readonly searchInput: Locator;

    constructor(page: Page) {
        super(page);
        this.sidebar = page.getByRole('navigation', { name: 'Content types' });
        this.searchTrigger = this.sidebar.getByRole('button', {
            name: /Search/
        });
        this.searchDialog = page.getByRole('dialog');
        this.searchInput = page.getByPlaceholder(
            'Search collections and pages…'
        );
    }

    /** Navigate straight to a workspace's Content Library. */
    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/content`);
    }

    /** A collapsible group trigger by label ("Collections" / "Pages"). */
    group(label: string): Locator {
        return this.sidebar.getByRole('button', {
            name: new RegExp(`^${label}`)
        });
    }

    /** Expand a collapsible group. */
    async expandGroup(label: string) {
        await this.group(label).click();
    }

    /** A category label in the sidebar ("Favorites" / "Workspace" / "Manage"). */
    sectionLabel(label: string): Locator {
        return this.sidebar.getByText(label, { exact: true });
    }

    /** A content-type row link by its label. */
    typeLink(label: string): Locator {
        return this.sidebar.getByRole('link', { name: label, exact: true });
    }

    /** The pin / unpin toggle for a type row. */
    pinToggle(label: string, pinned = false): Locator {
        return this.sidebar.getByRole('button', {
            name: `${pinned ? 'Unpin' : 'Pin'} ${label}`
        });
    }

    /** Open the search palette via its trigger button. */
    async openSearch() {
        await this.searchTrigger.click();
        await this.searchDialog.waitFor();
    }

    /** Open the search palette via the Ctrl/⌘+K shortcut. */
    async openSearchByShortcut() {
        // Give the page DOM focus first (just-loaded viewports aren't focused,
        // so a bare keypress wouldn't reach the window-level shortcut listener).
        // Focusing the trigger doesn't open the palette — only the shortcut does.
        await this.searchTrigger.focus();
        await this.page.keyboard.press('Control+k');
        await this.searchDialog.waitFor();
    }

    /** A result option in the open palette. */
    searchOption(label: string): Locator {
        return this.searchDialog.getByRole('option', {
            name: new RegExp(label)
        });
    }

    /** The selected-type pane heading. */
    viewHeading(label: string): Locator {
        return this.page.getByRole('heading', { name: label, level: 1 });
    }

    /** The collection records table (by its `{label} records` aria-label). */
    recordsTable(label: string): Locator {
        return this.page.getByRole('table', {
            name: new RegExp(`${label} records`)
        });
    }

    /** The data rows of the records table (excludes the header row). */
    recordRows(label: string): Locator {
        return this.recordsTable(label).locator('tbody tr');
    }

    /**
     * The cells of one body column, by 1-based `<td>` position (the leading
     * selection checkbox is column 1, so the first data column is 2).
     */
    recordColumnCells(label: string, nthChild: number): Locator {
        return this.recordRows(label).locator(`td:nth-child(${nthChild})`);
    }

    /** The records search box. */
    get recordsSearch(): Locator {
        return this.page.getByRole('searchbox', { name: 'Search records' });
    }

    /** The "Add record" action in the records header. */
    get addRecord(): Locator {
        return this.page.getByRole('button', { name: 'Add record' });
    }

    /** The entry editor's primary action button (label varies by type/state). */
    get editorSave(): Locator {
        return this.page.getByRole('button', {
            name: /^(Save|Save draft|Save & publish|Publish)$/
        });
    }

    /** The entry editor's "Back to records" link (present when editing a row). */
    get editorBackLink(): Locator {
        return this.page.getByRole('link', { name: 'Back to records' });
    }

    /** The column-picker trigger. */
    get columnsButton(): Locator {
        return this.page.getByRole('button', { name: 'Columns' });
    }

    /** A column-picker checkbox option by its label. */
    columnOption(label: string): Locator {
        return this.page.getByRole('checkbox', { name: label, exact: true });
    }

    /** A column header cell in the records table by label. */
    columnHeader(table: string, label: string): Locator {
        return this.recordsTable(table).getByRole('columnheader', {
            name: label
        });
    }

    /** The sort button inside a column header, by the column's label. */
    sortHeader(label: string): Locator {
        return this.page.getByRole('button', { name: `Sort by ${label}` });
    }

    /** The filter-drawer trigger ("Filters" / "Filters (N)"). */
    get filtersButton(): Locator {
        return this.page.getByRole('button', { name: /Filters/ });
    }

    /** The records pagination "Next page" control. */
    get nextPage(): Locator {
        return this.page.getByRole('button', { name: 'Next page' });
    }

    /** The records empty/no-match title. */
    get noRecordsMatch(): Locator {
        return this.page.getByText('No records match');
    }

    /** Every column header in the records table (incl. the leading checkbox). */
    columnHeaders(table: string): Locator {
        return this.recordsTable(table).getByRole('columnheader');
    }

    /** The drag handle for a column row in the column picker, used to reorder it. */
    reorderHandle(label: string): Locator {
        return this.page.getByRole('button', {
            name: `Reorder ${label} column`
        });
    }

    /** The header select-all checkbox. */
    get selectAll(): Locator {
        return this.page.getByRole('checkbox', {
            name: 'Select all rows on this page'
        });
    }

    /** The selection checkbox in a given data row. */
    rowCheckbox(table: string, index: number): Locator {
        // Each data row carries exactly one checkbox; its accessible name is the
        // row's own label ("Select <first field value>"), so match by role.
        return this.recordRows(table).nth(index).getByRole('checkbox');
    }

    /** The row-actions menu trigger (kebab) in a given data row. */
    rowActions(table: string, index: number): Locator {
        return this.recordRows(table)
            .nth(index)
            .getByRole('button', { name: 'Actions for this record' });
    }

    /** A row-actions menu item by its label (the menu must be open). */
    actionItem(label: string | RegExp): Locator {
        return this.page.getByRole('menuitem', { name: label });
    }

    /** The "{n} selected" count text in the selection bar. */
    get selectionCount(): Locator {
        return this.page.getByText(/\d+ selected/);
    }

    /** The selection bar's Clear button. */
    get clearSelection(): Locator {
        return this.page.getByRole('button', { name: 'Clear' });
    }

    /** Visible text in the selected-type / placeholder pane. */
    paneText(text: string): Locator {
        return this.page.getByText(text);
    }

    /** The "no content types" empty-state title. */
    get emptyTitle(): Locator {
        return this.page.getByText('No content types yet');
    }

    /** The load-error title. */
    get errorTitle(): Locator {
        return this.page.getByText('Couldn’t load content types');
    }

    /** The error state's retry button. */
    get retry(): Locator {
        return this.page.getByRole('button', { name: 'Try again' });
    }
}
