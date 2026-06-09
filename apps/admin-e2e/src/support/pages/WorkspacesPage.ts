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
    /** The "Filter" button that opens the status popover. */
    readonly filterButton: Locator;
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
        this.filterButton = page.getByRole('button', { name: 'Filter' });
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

    // --- create dialog ---

    dialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Create a workspace' });
    }

    nameField(): Locator {
        return this.dialog().getByLabel('Name');
    }

    descriptionField(): Locator {
        return this.dialog().getByLabel('Description');
    }

    colorSwatch(color: string): Locator {
        return this.dialog().getByRole('radio', {
            name: `Use the ${color} accent`
        });
    }

    submitCreate(): Locator {
        return this.dialog().getByRole('button', { name: 'Create workspace' });
    }

    cancelCreate(): Locator {
        return this.dialog().getByRole('button', { name: 'Cancel' });
    }

    /** A validation message inside the dialog. */
    fieldError(message: string): Locator {
        return this.dialog().getByText(message);
    }

    async openCreate() {
        await this.newWorkspaceButton.click();
        await this.dialog().waitFor();
    }

    /** A toast message (sonner, portaled to the body). */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }
}
