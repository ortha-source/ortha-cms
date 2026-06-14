import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Members page at `/users` (from `@ortha-cms/users-admin`).
 *
 * Data comes from the `GET /api/users` mock (`mockMembers`); tests also need
 * `mockSignedIn` for the auth probe, since the page lives behind the shell's
 * gate. Permission-gated controls assume the signed-in user's `permissions`
 * (set via `mockSignedIn`).
 */
export class MembersPage extends BasePage {
    /** The page's `<h1>`. */
    readonly heading: Locator;
    /** The shell's primary nav — proof the gated layout wrapped the page. */
    readonly nav: Locator;
    /** The search box (leading search icon). */
    readonly search: Locator;
    /** The header's primary "Invite member" button. */
    readonly inviteButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Members',
            level: 1
        });
        this.nav = page.getByRole('navigation', { name: 'Primary' });
        this.search = page.getByRole('searchbox', {
            name: 'Search members by name or email'
        });
        this.inviteButton = page.getByRole('button', {
            name: 'Invite member'
        });
    }

    async goto() {
        await this.page.goto('/users');
    }

    /** A member's row, located by the member's visible name or email text. */
    row(nameOrEmail: string): Locator {
        return this.page.getByRole('row').filter({ hasText: nameOrEmail });
    }

    /**
     * The table loading skeleton — a `role="status"` region announcing
     * "Loading members…", shown while the list query is in flight (seed it with
     * `mockMembers(page, …, { delayMs })`).
     */
    tableSkeleton(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /Loading members/ });
    }

    /** A status pill anywhere in the table (e.g. "Invited"). */
    statusPill(label: string): Locator {
        return this.page.getByText(label, { exact: true });
    }

    /** The kebab actions trigger in a member's row. */
    actionsTrigger(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** Open a member's row menu. */
    async openActions(name: string) {
        await this.actionsTrigger(name).click();
    }

    /** A menu item by its label (rendered in the portaled menu). */
    menuItem(label: string): Locator {
        return this.page.getByRole('menuitem', { name: label });
    }

    /** The read-only role chip in a member's row. */
    roleChip(name: string): Locator {
        return this.row(name).getByText(/^(Admin|Contributor|Viewer)$/);
    }

    // --- invite wizard (/users/invite) ---

    inviteHeading(): Locator {
        return this.page.getByRole('heading', {
            name: 'Invite a member',
            level: 1
        });
    }

    inviteEmail(): Locator {
        return this.page.getByLabel('Email');
    }

    continueToRole(): Locator {
        return this.page.getByRole('button', { name: 'Continue to role' });
    }

    continueToWorkspaces(): Locator {
        return this.page.getByRole('button', {
            name: 'Continue to workspaces'
        });
    }

    inviteRole(label: string): Locator {
        return this.page.getByRole('radio', { name: label });
    }

    /** A workspace checkbox in the assignment step, by its visible name. */
    inviteWorkspace(name: string): Locator {
        return this.page.getByRole('checkbox', { name });
    }

    /** A workspace-access mode tile ("All workspaces" / "Specific workspaces"). */
    inviteWorkspaceMode(label: string): Locator {
        return this.page.getByRole('radio', { name: label });
    }

    /** The search box in the assignment step (shown in "Specific" mode). */
    workspaceSearch(): Locator {
        return this.page.getByLabel('Search workspaces');
    }

    sendInvite(): Locator {
        return this.page.getByRole('button', { name: 'Send invite' });
    }

    // --- edit dialog ---

    editDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    editRoleSelect(): Locator {
        return this.editDialog().getByRole('combobox');
    }

    // --- pagination ---

    /** The "{from}–{to} of {total}" readout in the pagination bar. */
    paginationRange(): Locator {
        return this.page.getByText(/^\d+.\d+ of \d+$/);
    }

    /** Pick a rows-per-page value from the page-size select. */
    async setRowsPerPage(value: string) {
        await this.page
            .getByRole('combobox', { name: 'Rows per page' })
            .click();
        await this.page
            .getByRole('option', { name: value, exact: true })
            .click();
    }

    nextPage(): Locator {
        return this.page.getByRole('button', { name: 'Next page' });
    }

    prevPage(): Locator {
        return this.page.getByRole('button', { name: 'Previous page' });
    }

    // --- query-builder filter drawer ---

    /** The toolbar "Filters" trigger (its label carries the active count). */
    filterTrigger(): Locator {
        return this.page.getByRole('button', { name: /^Filters/ });
    }

    /** The query-builder drawer surface (a modal dialog titled "Query Builder"). */
    filterDrawer(): Locator {
        return this.page.getByRole('dialog', { name: 'Query Builder' });
    }

    /** Open the filter drawer. */
    async openFilters() {
        await this.filterTrigger().click();
        await this.filterDrawer().waitFor();
    }

    /** Add a rule to the (root) group. */
    async addRule() {
        await this.filterDrawer()
            .getByRole('button', { name: 'Add rule' })
            .click();
    }

    /** The field / operator / value comboboxes of the first rule, in order. */
    private ruleCombobox(index: number): Locator {
        return this.filterDrawer().getByRole('combobox').nth(index);
    }

    /** Pick a field for the first rule by its visible label (e.g. "Status"). */
    async selectField(label: string) {
        await this.ruleCombobox(0).click();
        await this.page
            .getByRole('option', { name: label, exact: true })
            .click();
    }

    /** Pick an enum value for the first rule (the third combobox). */
    async selectEnumValue(label: string) {
        await this.ruleCombobox(2).click();
        await this.page
            .getByRole('option', { name: label, exact: true })
            .click();
    }

    /** Type a scalar value into the first rule's text input. */
    async fillValue(value: string) {
        await this.filterDrawer().getByRole('textbox').last().fill(value);
    }

    /** Commit the drawer's draft to the URL. */
    async applyFilters() {
        await this.filterDrawer()
            .getByRole('button', { name: 'Apply' })
            .click();
    }

    /** Clear all conditions from the drawer. */
    async resetFilters() {
        await this.filterDrawer()
            .getByRole('button', { name: 'Reset' })
            .click();
    }

    // --- empty / no-access states ---

    noAccessText(): Locator {
        return this.page.getByText('You don’t have access to members');
    }

    emptyText(text: string): Locator {
        return this.page.getByText(text);
    }
}
