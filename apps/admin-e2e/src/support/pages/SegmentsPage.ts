import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The audience directory at `/segments`, and the editor pages behind it
 * (`/segments/new`, `/segments/:id`).
 *
 * One object for both because they are one flow: every route into the editor
 * starts on the directory, and a spec that creates an audience then asserts on
 * the list it came back to.
 */
export class SegmentsPage extends BasePage {
    readonly heading: Locator;
    readonly createLink: Locator;
    readonly search: Locator;
    readonly table: Locator;
    readonly nextPage: Locator;
    readonly previousPage: Locator;
    readonly errorAlert: Locator;

    // The editor form.
    readonly nameField: Locator;
    readonly keyField: Locator;
    readonly tagsField: Locator;
    readonly submit: Locator;

    constructor(page: Page) {
        super(page);
        // The page is about audiences; "Segments" is the section's name in
        // the nav and the crumb.
        this.heading = page.getByRole('heading', {
            name: 'Audiences',
            level: 1
        });
        this.createLink = page.getByRole('link', { name: 'New audience' });
        this.search = page.getByRole('searchbox', { name: 'Search audiences' });
        this.table = page.getByRole('table');
        this.nextPage = page.getByRole('button', { name: 'Next page' });
        this.previousPage = page.getByRole('button', { name: 'Previous page' });
        this.errorAlert = page.getByRole('alert');

        // Not `exact`: a required field's label carries the `*` mark, so its
        // accessible name is "Name *" rather than "Name". The content library's
        // own `fieldTextbox` defaults to the same reading for the same reason.
        this.nameField = page.getByRole('textbox', { name: 'Name' });
        this.keyField = page.getByRole('textbox', { name: 'Key' });
        // The chip input's text box — what a tag is typed into.
        this.tagsField = page.getByRole('textbox', { name: 'Reader tags' });
        this.submit = page.getByRole('button', {
            name: /Create audience|^Save$/
        });
    }

    async goto(): Promise<void> {
        await this.page.goto('/segments');
    }

    async gotoNew(): Promise<void> {
        await this.page.goto('/segments/new');
    }

    async gotoEdit(id: string): Promise<void> {
        await this.page.goto(`/segments/${id}`);
    }

    /** One row of the directory, by the audience's name. */
    row(name: string): Locator {
        return this.page.getByRole('row').filter({ hasText: name });
    }

    /** The row menu for one audience. */
    rowMenu(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** Delete one audience through its row menu and the confirm dialog. */
    async deleteAudience(name: string): Promise<void> {
        await this.rowMenu(name).click();
        await this.page.getByRole('menuitem', { name: 'Delete' }).click();
        await this.confirmDelete.click();
    }

    /** The delete confirmation. */
    get deleteDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** The confirmation's destructive button. */
    get confirmDelete(): Locator {
        return this.deleteDialog.getByRole('button', {
            name: 'Delete audience'
        });
    }

    /** The "Used by" cell's link for one audience. */
    usageLink(name: string): Locator {
        return this.row(name).getByRole('link', {
            name: new RegExp(`see where ${name} is used`)
        });
    }

    /** The line under the table saying what an audience is. */
    get modelNote(): Locator {
        return this.page.getByText(/A reader arrives with tags from your site/);
    }

    /** The pager's "Page X of Y" readout — drawn only past one page. */
    get pageReadout(): Locator {
        return this.page.getByText(/^Page \d+ of \d+$/);
    }

    /** Pick a rows-per-page size from the footer control. */
    async setPageSize(size: number): Promise<void> {
        await this.page
            .getByRole('combobox', { name: 'Rows per page' })
            .click();
        await this.page
            .getByRole('option', { name: String(size), exact: true })
            .click();
    }

    /** The "Offered in" cell's badge for one audience. */
    offeredIn(name: string): Locator {
        return this.row(name).getByText(/Every workspace|\d+ workspaces?/);
    }

    /**
     * One workspace's checkbox on the editor page.
     *
     * Scoped through its `<label>` rather than by accessible name: the
     * design-system `Checkbox` is a Radix button carrying no name of its own,
     * and the row's text is what a reader actually sees.
     */
    workspaceBox(name: string): Locator {
        return this.page
            .locator('label')
            .filter({ hasText: name })
            .getByRole('checkbox');
    }

    /** One of the two "Offered in" cards: "Every workspace" or "Some workspaces". */
    offeredInChoice(choice: 'Every workspace' | 'Some workspaces'): Locator {
        return this.page.getByRole('radio', { name: new RegExp(`^${choice}`) });
    }

    // --- tags as chips ----------------------------------------------------

    /** Type one tag and commit it as a chip. */
    async addTag(tag: string): Promise<void> {
        await this.tagsField.fill(tag);
        await this.tagsField.press('Enter');
    }

    /** One chip's remove button — the chip, as a control. */
    tagChip(tag: string): Locator {
        // Exact: "Remove tag acme" is a prefix of "Remove tag acme-legacy".
        return this.page.getByRole('button', {
            name: `Remove tag ${tag}`,
            exact: true
        });
    }

    // --- beside the form ---------------------------------------------------

    /** "Try a reader" — the tester's input. */
    get tester(): Locator {
        return this.page.getByRole('textbox', { name: 'Try a reader' });
    }

    /** The tester's verdict ("In …" / "Not in …"). */
    get testerVerdict(): Locator {
        return this.page
            .getByRole('status')
            .filter({ hasText: /^(In|Not in) / });
    }

    /** The "Used by N entries" panel beside the edit form. */
    get usagePanel(): Locator {
        return this.page.getByRole('region', {
            name: /^Used by|^Not used yet/
        });
    }

    /** One entry row of the usage panel. */
    usageRow(title: string): Locator {
        return this.usagePanel.getByRole('listitem').filter({ hasText: title });
    }

    /** The usage panel's "Show all N" / "Show fewer" toggle. */
    get usageToggle(): Locator {
        return this.usagePanel.getByRole('button', {
            name: /^Show all \d+$|^Show fewer$/
        });
    }

    /** The edit page's "Delete…" button. */
    get deleteButton(): Locator {
        return this.page.getByRole('button', { name: 'Delete…' });
    }

    /** The field-level error for one message. */
    fieldError(message: string | RegExp): Locator {
        return this.page.getByText(message);
    }

    // --- the entry editor's Access tab -----------------------------------

    /**
     * One audience's three-state control on the Access tab.
     *
     * A `radiogroup`, not a `group`: the design-system `SegmentedControl` is a
     * Radix `ToggleGroup type="single"`, which is exactly what makes "not set"
     * a reachable third answer rather than a checkbox's absence.
     */
    accessControl(audience: string): Locator {
        return this.page.getByRole('radiogroup', {
            name: `Access for ${audience}`
        });
    }

    /** One state of one audience's control ("Not set" / "Can see" / "Cannot see"). */
    accessOption(audience: string, state: string): Locator {
        return this.accessControl(audience).getByRole('radio', { name: state });
    }

    /** Set one audience's state. */
    async setAccess(audience: string, state: string): Promise<void> {
        await this.accessOption(audience, state).click();
    }

    /** The Access tab's "Set all…" menu trigger. */
    get bulkMenu(): Locator {
        return this.page.getByRole('button', { name: 'Set all…' });
    }

    /** Open the "Set all…" menu. */
    async openBulkMenu(): Promise<void> {
        await this.bulkMenu.click();
    }

    /**
     * One "set every audience to…" item in the open "Set all…" menu —
     * "All can see", "None can see" or "Clear all".
     */
    bulkAction(label: 'All can see' | 'None can see' | 'Clear all'): Locator {
        return this.page.getByRole('menuitem', { name: label, exact: true });
    }

    /** The tab's one-line outcome over the toolbar. */
    get accessLine(): Locator {
        return this.page.getByTestId('access-line');
    }

    /** The "Changed" pill the line shows once something is staged. */
    get accessChanged(): Locator {
        // The line's pill — each staged row carries one too.
        return this.accessLine.getByText('Changed', { exact: true });
    }

    /** The Access tab's "All / Set" switch — one of its two options. */
    accessRowsOption(view: 'All' | 'Set'): Locator {
        return this.page
            .getByRole('radiogroup', { name: 'Show audiences' })
            .getByRole('radio', { name: new RegExp(`^${view}, \\d+$`) });
    }

    /** One row of the Access tab's table, by audience name. */
    accessRow(audience: string): Locator {
        return this.page
            .getByRole('table', { name: 'Audiences' })
            .getByRole('row')
            .filter({ has: this.accessControl(audience) });
    }

    /** The access chip in the editor's Details block. */
    get accessChip(): Locator {
        return this.page.getByRole('link', {
            name: /Who can read this entry/
        });
    }
}
