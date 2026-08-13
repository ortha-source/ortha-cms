import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Workspaces page at `/workspaces` (from
 * `@ortha-cms/workspaces-admin`).
 *
 * Unlike the auth suites there is **no `/api` mock for the data**: the page
 * reads from the plugin's in-memory `workspacesClient` stub, whose seed is fixed
 * and resets with the browser context each test — so it is as deterministic as a
 * network mock. Tests still need `mockSignedIn` for the auth probe, since the
 * page lives behind the shell's gate.
 */
export class WorkspacesPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The search box (leading search icon). */
    readonly search: Locator;
    /** The workspaces table (scopes row/link lookups away from the sidebar). */
    readonly table: Locator;
    /**
     * The header "New workspace" CTA. An identical button appears in the empty
     * state, so this takes the first (the header is first in the DOM).
     */
    readonly newWorkspaceButton: Locator;

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
        this.table = page.getByRole('table', { name: 'Workspaces' });
        this.newWorkspaceButton = page
            .getByRole('button', { name: 'New workspace' })
            .first();
    }

    async goto() {
        await this.page.goto('/workspaces');
        await this.heading.waitFor();
    }

    /** The live "{shown} of {total}" count. */
    count(): Locator {
        return this.page.getByText(/^\d+ of \d+$/);
    }

    /**
     * The table loading skeleton — a `role="status"` region announcing
     * "Loading workspaces…", shown while the list query is in flight (seed it
     * with `mockWorkspaces(page, …, { delayMs })`).
     */
    listSkeleton(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /Loading workspaces/ });
    }

    /**
     * A workspace row, located by its name link — scoped to the table so it
     * never matches the sidebar's Workspaces quick-list (same names).
     */
    card(name: string): Locator {
        return this.table.getByRole('row').filter({
            has: this.page.getByRole('link', { name, exact: true })
        });
    }

    /** The link that opens a workspace (its name), scoped to the table. */
    openButton(name: string): Locator {
        return this.table.getByRole('link', { name, exact: true });
    }

    /**
     * A row's avatar monogram — the initials derived on the client. The avatar
     * is a design-system `Avatar` (a Radix span pair with no role or test id),
     * so it is addressed as the first span of the row's first cell, ahead of
     * the name link.
     */
    monogram(name: string | RegExp): Locator {
        return this.table
            .getByRole('row')
            .filter({ hasText: name })
            .getByRole('cell')
            .first()
            .locator('span')
            .first();
    }

    // --- status filter chips (SegmentedControl → role=radio) ---

    statusOption(label: string): Locator {
        return this.page.getByRole('radio', { name: label });
    }

    /** Pick a status via its filter chip. */
    async filterByStatus(label: string) {
        await this.statusOption(label).click();
    }

    // --- empty state ---

    emptyText(text: string): Locator {
        return this.page.getByText(text);
    }

    clearFiltersButton(): Locator {
        return this.page.getByRole('button', { name: 'Clear filters' });
    }

    // --- create ---

    /** Open the create wizard — a full page at `/workspaces/new`, not a dialog. */
    async openCreate() {
        await this.newWorkspaceButton.click();
    }

    /** A toast message (sonner, portaled to the body). */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }
}
