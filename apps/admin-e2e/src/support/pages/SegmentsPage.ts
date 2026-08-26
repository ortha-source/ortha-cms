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
        this.heading = page.getByRole('heading', {
            name: 'Segments',
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

    /** The "Offered in" summary badge on the editor page. */
    get offeredInBadge(): Locator {
        return this.page.getByText(/Every workspace|\d+ workspaces?/).first();
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

    /** A "set every audience to…" bulk control. */
    bulkAction(label: string): Locator {
        return this.page.getByRole('button', { name: label, exact: true });
    }

    /** The tab's open/restricted summary badge. */
    get accessSummary(): Locator {
        return this.page.getByText(/Readable by everyone|^Restricted$/);
    }

    /** The "Changed" pill the tab shows once something is staged. */
    get accessChanged(): Locator {
        return this.page.getByText('Changed', { exact: true });
    }

    /** The entry header's access chip. */
    get accessChip(): Locator {
        return this.page.getByRole('link', {
            name: /Who can read this entry/
        });
    }
}
