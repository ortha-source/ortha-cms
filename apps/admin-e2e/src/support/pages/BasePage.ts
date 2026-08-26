import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Common base for all page objects: holds the Playwright `page` and the shared
 * query-builder **filter drawer** helpers (`@orthacms/query-builder-admin`),
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

    /**
     * The signed-in address as the account-menu trigger states it.
     *
     * Scoped to the trigger, because the same address is a legitimate second
     * match elsewhere on a page that lists people — the Members table renders
     * it in every matching row. A page-wide `getByText(email)` therefore races
     * the roster: it resolves to one node until that table paints and to two
     * afterwards, and the second one is a **strict-mode violation**, which does
     * not retry. That is a latent trip-wire on any assertion about the account,
     * so the scope belongs here rather than in each spec.
     */
    accountMenuEmail(email: string): Locator {
        return this.accountMenuTrigger().getByText(email);
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

    /**
     * The surface hosting the query builder. The **drawer** (a dialog) by
     * default; a page that mounts the builder as an **inline panel** overrides
     * this to return that region, so the shared helpers below work for both.
     */
    filterSurface(): Locator {
        return this.filterDrawer();
    }

    /** Open the filter surface (drawer or inline panel). */
    async openFilters() {
        await this.filterTrigger().click();
        await this.filterSurface().waitFor();
    }

    /** Add a rule to the (root) group. */
    async addRule() {
        await this.filterSurface()
            .getByRole('button', { name: 'Add rule' })
            .click();
    }

    /** The field / operator / value comboboxes of the first rule, in order. */
    private ruleCombobox(index: number): Locator {
        return this.filterSurface().getByRole('combobox').nth(index);
    }

    /** Pick a field for the first rule by its visible label (e.g. "Status"). */
    async selectField(label: string) {
        await this.ruleCombobox(0).click();
        await this.page
            .getByRole('option', { name: label, exact: true })
            .click();
    }

    /**
     * Pick a field in the searchable, relation-grouped field picker: type
     * `search` to disambiguate a leaf label that repeats across relation groups
     * (e.g. "Name" under both "Author" and "Tags"), then click the leaf option.
     * Use for a relation-path field (`author.name`); {@link selectField} still
     * works for a unique flat field.
     */
    async selectFieldSearch(search: string, optionLabel: string) {
        await this.ruleCombobox(0).click();
        await this.page
            .getByPlaceholder('Search fields and relations')
            .fill(search);
        await this.page
            .getByRole('option', { name: optionLabel, exact: true })
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

    /**
     * Tick members in the enum **multi**-select — the value editor an enum
     * field gets under `is one of`, which is a checkbox group rather than the
     * third combobox {@link selectEnumValue} drives.
     *
     * `click()`, not `check()`: Playwright's `_setChecked` re-reads the state a
     * tick later and raises a non-recoverable error if it hasn't landed, which
     * is a coin flip for any control that re-renders through a parent's state.
     */
    async pickEnumValues(...labels: string[]) {
        const group = this.filterSurface().getByRole('group', {
            name: 'Value'
        });
        for (const label of labels) {
            const box = group.getByRole('checkbox', { name: label });
            await box.click();
            await expect(box).toBeChecked();
        }
    }

    /** The inline validation error rendered under an invalid rule. */
    ruleError(): Locator {
        return this.filterSurface().getByTestId('qb-rule-error');
    }

    /** Type a scalar value into the first rule's text input. */
    async fillValue(value: string) {
        await this.filterSurface().getByRole('textbox').last().fill(value);
    }

    /** The builder's Apply control — for asserting its enabled/disabled state. */
    applyButton(): Locator {
        return this.filterSurface().getByRole('button', { name: 'Apply' });
    }

    /** Commit the builder's draft to the URL. */
    async applyFilters() {
        await this.applyButton().click();
    }

    /**
     * The builder's own "couldn't load the filterable fields" state. Distinct
     * from an empty picker: without the field definitions every rule fails the
     * Apply gate, so the panel must say so rather than render a dead button.
     */
    filterFieldsError(): Locator {
        return this.filterSurface().getByRole('alert');
    }

    /**
     * Pick the operator by label for the first rule. Unlike
     * {@link selectOperator} this waits for the option list, so it works for
     * the operators added alongside relation filtering ("does not contain",
     * "is none of", "is not empty") whose labels are longer.
     */
    async selectOperatorExact(label: string) {
        await this.filterSurface().getByRole('combobox').nth(1).click();
        await this.page
            .getByRole('option', { name: label, exact: true })
            .click();
    }

    /** Clear all conditions from the builder. */
    async resetFilters() {
        await this.filterSurface()
            .getByRole('button', { name: 'Reset' })
            .click();
    }
}
