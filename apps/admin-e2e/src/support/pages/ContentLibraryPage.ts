import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Content Library at `/workspaces/:id/content` (from
 * `@ortha-cms/content-admin`) — the second-sidebar nav (collapsible Collections
 * and Pages groups, a Favorites section, a Manage section with History/Trash),
 * the ⌘K search palette, and the selected-type pane. Seed it with
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

    /** A static manage link ("History" / "Trash"). */
    manageLink(label: string): Locator {
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

    /** The records search box. */
    get recordsSearch(): Locator {
        return this.page.getByRole('searchbox', { name: 'Search records' });
    }

    /** The "Add record" action in the records header. */
    get addRecord(): Locator {
        return this.page.getByRole('button', { name: 'Add record' });
    }

    /** The column-picker trigger. */
    get columnsButton(): Locator {
        return this.page.getByRole('button', { name: 'Columns' });
    }

    /** A column-picker checkbox option by its label. */
    columnOption(label: string): Locator {
        return this.page.getByRole('menuitemcheckbox', { name: label });
    }

    /** A column header cell in the records table by label. */
    columnHeader(table: string, label: string): Locator {
        return this.recordsTable(table).getByRole('columnheader', {
            name: label
        });
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
