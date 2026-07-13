import { type Locator, type Page } from '@playwright/test';

/**
 * Common base for all page objects: holds the Playwright `page` and the shared
 * query-builder **filter drawer** helpers (`@ortha-cms/query-builder-admin`),
 * since the drawer is the same component wherever a list page mounts it.
 */
export abstract class BasePage {
    constructor(protected readonly page: Page) {}

    // --- toolbar account menu (shell chrome, contributed by users-admin) ---

    /** The trailing account-menu trigger (the avatar button). */
    accountMenuTrigger(): Locator {
        return this.page.getByRole('button', { name: 'Account menu' });
    }

    /** Open the account menu. */
    async openAccountMenu() {
        await this.accountMenuTrigger().click();
    }

    /** An account-menu item by label (e.g. "My profile", "Logout"). */
    accountMenuItem(label: string): Locator {
        return this.page.getByRole('menuitem', { name: label });
    }

    // --- command palette (sidebar search, shell chrome) ---

    /** The sidebar search trigger that opens the ⌘K command palette. */
    searchTrigger(): Locator {
        return this.page.getByRole('button', { name: 'Search', exact: true });
    }

    /** Open the command palette via the sidebar search trigger. */
    async openCommandPalette() {
        await this.searchTrigger().click();
        await this.commandInput().waitFor();
    }

    /** The palette's search input. */
    commandInput(): Locator {
        return this.page.getByPlaceholder('Search or jump to…');
    }

    /**
     * A palette result (a command option) by its exact accessible name. Exact,
     * because a workspace ("Marketing site") is a substring of its content-type
     * results ("Blog posts Marketing site").
     */
    commandItem(name: string): Locator {
        return this.page.getByRole('option', { name, exact: true });
    }

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

    /** Pick the operator for the first rule by its label (the second combobox). */
    async selectOperator(label: string) {
        await this.ruleCombobox(1).click();
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

    /** The inline validation error rendered under an invalid rule. */
    ruleError(): Locator {
        return this.filterDrawer().getByTestId('qb-rule-error');
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
}
