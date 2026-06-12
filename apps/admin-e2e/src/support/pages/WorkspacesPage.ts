import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Workspaces page at `/workspaces` (from
 * `@ortha-cms/workspaces-admin`).
 *
 * Data comes from the `GET /api/workspaces` mock (`mockWorkspaces`); tests also
 * need `mockSignedIn` for the auth probe, since the page lives behind the
 * shell's gate. Create is hidden (the API is read-only), so there are no
 * create-dialog locators here.
 */
export class WorkspacesPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The search box (leading search icon). */
    readonly search: Locator;
    /** The "Filter" button that opens the status popover. */
    readonly filterButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Workspaces',
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.search = page.getByRole('searchbox', {
            name: 'Search workspaces'
        });
        this.filterButton = page.getByRole('button', { name: 'Filter' });
    }

    async goto() {
        await this.page.goto('/workspaces');
        await this.heading.waitFor();
    }

    /** The live "{shown} of {total}" count. */
    count(): Locator {
        return this.page.getByText(/^\d+ of \d+$/);
    }

    /** A workspace card, located by its accessible name (a labelled group). */
    card(name: string): Locator {
        return this.page.getByRole('group', { name, exact: true });
    }

    /** The button that opens a workspace (its title). */
    openButton(name: string): Locator {
        return this.card(name).getByRole('button', { name, exact: true });
    }

    /** The member-stack button inside a card. */
    memberButton(name: string): Locator {
        return this.card(name).getByRole('button', { name: 'View members' });
    }

    // --- status filter popover ---

    async openFilter() {
        await this.filterButton.click();
    }

    statusOption(label: string): Locator {
        return this.page.getByRole('radio', { name: label });
    }

    /** Open the filter, pick a status, then close the popover. */
    async filterByStatus(label: string) {
        await this.openFilter();
        await this.statusOption(label).click();
        await this.page.keyboard.press('Escape');
    }

    /** The count badge on the Filter button (shown when status ≠ default). */
    filterBadge(): Locator {
        return this.filterButton.getByText('1', { exact: true });
    }

    // --- member popover (portaled) ---

    /** A member's email — rendered only inside the open member popover. */
    memberEmail(email: string): Locator {
        return this.page.getByText(email, { exact: true });
    }

    /** A member's name — rendered only inside the open member popover. */
    memberName(name: string): Locator {
        return this.page.getByText(name, { exact: true });
    }

    // --- empty state ---

    emptyText(text: string): Locator {
        return this.page.getByText(text);
    }

    clearFiltersButton(): Locator {
        return this.page.getByRole('button', { name: 'Clear filters' });
    }
}
