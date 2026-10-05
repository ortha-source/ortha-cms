import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Common base for all page objects: holds the Playwright `page` and the shared
 * query-builder filter helpers (`@orthacms/query-builder-admin`), since the
 * builder is the same component wherever a page mounts it. Each page points
 * {@link BasePage.filterSurface} at the surface it mounts — every list page
 * uses the `QueryBuilderPopover` anchored to its icon-only "Filters" button —
 * and the helpers below work unchanged.
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

    /**
     * The toolbar's icon-only "Filters" trigger. Its accessible name carries
     * the applied count ("Filters" / "Filters, 2 applied").
     */
    filterTrigger(): Locator {
        return this.page.getByRole('button', { name: /^Filters/ });
    }

    /**
     * The applied-rule count drawn on the trigger's corner. Hidden from
     * assistive tech — the trigger's accessible name carries the same number
     * as words — so it is located by test id rather than by role.
     */
    filterCountBadge(): Locator {
        return this.filterTrigger().getByTestId('qb-filter-count');
    }

    /**
     * The `QueryBuilderDrawer` surface (a modal dialog titled "Query Builder").
     *
     * **No page in this repo mounts it** — every list page mounts the
     * `QueryBuilderPopover`. Kept for a consumer that mounts the
     * still-published drawer; it is not the default surface, because a default
     * nothing renders would fail a page that forgot to override with a locator
     * timeout instead of a useful message.
     */
    filterDrawer(): Locator {
        return this.page.getByRole('dialog', { name: 'Query Builder' });
    }

    /**
     * The surface hosting the query builder: the **popover** (a `dialog` named
     * by its "Filters" heading) anchored to the toolbar trigger, which is what
     * every list page mounts. A page whose popover is named something else —
     * the alarms rule editor's "Edit conditions" — overrides this, and the
     * shared helpers below then work unchanged.
     */
    filterSurface(): Locator {
        return this.page.getByRole('dialog', { name: 'Filters', exact: true });
    }

    /**
     * The control that opens {@link filterSurface}. The toolbar's "Filters"
     * button by default; a page that opens the builder from something else
     * (the alarm editor's "Edit conditions") overrides it.
     */
    protected filterOpener(): Locator {
        return this.filterTrigger();
    }

    /**
     * Open the filter popover. A no-op when it is already open, because the
     * trigger toggles: a second press would close it and discard the draft.
     *
     * The wait that means anything is on the trigger's own `aria-expanded`
     * plus the dialog actually being **visible**, not on the presence of a box.
     * A click whose `mouseup` lands after the layout shifted fires on the
     * common ancestor instead of the button and is still reported as a
     * successful click, so the action is lost in silence; waiting on a state
     * the app publishes is what turns that into a failure here rather than an
     * "element(s) not found" several assertions later. The popover also enters
     * with a short motion, so the first action inside it waits for it to land.
     */
    async openFilters() {
        const opener = this.filterOpener();
        if ((await opener.getAttribute('aria-expanded')) !== 'true') {
            await opener.click();
        }
        await expect(opener).toHaveAttribute('aria-expanded', 'true');
        await expect(this.filterSurface()).toBeVisible();
    }

    /** The builder's "Add rule" control (one group, so one control). */
    addRuleControl(): Locator {
        return this.filterSurface().getByRole('button', { name: 'Add rule' });
    }

    /** Add a rule to the (root) group. */
    async addRule() {
        await this.addRuleControl().click();
    }

    /**
     * The popover header's count of the **draft's** conditions ("No
     * conditions", "1 condition", …) — the number the product states, so a
     * spec asserts against it rather than counting rule rows itself.
     */
    filterConditionCount(): Locator {
        return this.filterSurface().getByText(
            /^(No conditions|\d+ conditions?)$/
        );
    }

    /** The field / operator / value comboboxes of the first rule, in order. */
    private ruleCombobox(index: number): Locator {
        return this.filterSurface().getByRole('combobox').nth(index);
    }

    /**
     * The field picker's listbox — the builder's own nested popover, layered
     * over the filter popover (it portals to `<body>`).
     */
    fieldPickerList(): Locator {
        return this.page.getByRole('listbox', { name: 'Field' });
    }

    /** Open the first rule's field picker and wait for its list. */
    async openFieldPicker() {
        await this.ruleCombobox(0).click();
        await expect(this.fieldPickerList()).toBeVisible();
    }

    /**
     * Expand a relation row in the open field picker (e.g. "Author"), which
     * reveals its fields beneath it. The row is an `option` named "Expand
     * <relation>" that becomes "Collapse <relation>" with `aria-expanded`, so
     * this waits on that rather than on the new rows.
     */
    async expandFieldPickerRelation(label: string) {
        await this.fieldPickerList()
            .getByRole('option', { name: `Expand ${label}`, exact: true })
            .click();
        await expect(
            this.fieldPickerList().getByRole('option', {
                name: `Collapse ${label}`,
                exact: true
            })
        ).toHaveAttribute('aria-expanded', 'true');
    }

    /** Scroll the open field picker's list with the mouse wheel. */
    async wheelFieldPicker(deltaY: number) {
        await this.fieldPickerList().hover();
        await this.page.mouse.wheel(0, deltaY);
    }

    /**
     * The field picker list's scroll metrics. Typed by hand, the same idiom as
     * `AgentsPage.proposalReasonScroll`: this package has no DOM lib, so
     * Playwright's `SVGElement | HTMLElement` carries no scroll metrics.
     */
    async fieldPickerScroll(): Promise<{
        client: number;
        scroll: number;
        top: number;
    }> {
        return this.fieldPickerList().evaluate((element) => {
            const box = element as unknown as {
                clientHeight: number;
                scrollHeight: number;
                scrollTop: number;
            };
            return {
                client: box.clientHeight,
                scroll: box.scrollHeight,
                top: box.scrollTop
            };
        });
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

    /**
     * One chip of the applied-filter summary — the resting read-out of one
     * applied condition, under the toolbar; removing it re-commits the
     * narrowed tree at once.
     *
     * Matched on its `title`, which carries the whole condition ("Author · Name
     * contains Ada"). The visible text is split across spans, and the same
     * field label also appears on the rule row's trigger and in the builder's
     * status line — so a `getByText` for it is a strict-mode violation rather
     * than a locator.
     */
    filterChip(condition: string | RegExp): Locator {
        return this.page.getByTitle(condition);
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

    /**
     * Press Apply. A valid draft is committed to the URL and the popover
     * closes; an invalid one shows its inline errors and stays open — so this
     * waits for neither, and a spec asserts whichever it expects.
     */
    async applyFilters() {
        await this.applyButton().click();
    }

    /**
     * The builder's own "couldn't load the filterable fields" state. Distinct
     * from an empty picker: without the field definitions every rule fails the
     * Apply gate, so the popover must say so rather than render a dead button.
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

    /**
     * Close the filter popover without applying (Escape), discarding the
     * draft. A no-op when it is already closed — Apply closes it on success, so
     * a spec that applied and then closes is stating where it expects to be.
     *
     * Escape goes to the topmost layer, so this must not be called with one of
     * the builder's own pickers open: that press would only close the picker.
     */
    async closeFilters() {
        const opener = this.filterOpener();
        if ((await opener.getAttribute('aria-expanded')) === 'true') {
            await this.page.keyboard.press('Escape');
        }
        await expect(opener).toHaveAttribute('aria-expanded', 'false');
        await expect(this.filterSurface()).toBeHidden();
    }

    /**
     * Remove one applied condition from the summary. `label` is the chip's
     * "<path> <operator>" text — the remove button's accessible name is
     * "Remove condition <path> <operator>".
     */
    async removeFilterChip(label: string) {
        await this.page
            .getByRole('button', { name: `Remove condition ${label}` })
            .click();
    }

    /** Drop every applied condition from the summary in one action. */
    async clearAllFilters() {
        await this.page.getByRole('button', { name: 'Clear all' }).click();
    }
}
