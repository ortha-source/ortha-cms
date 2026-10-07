import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the content model (`@orthacms/schema-builder-admin`) — the
 * global, read-only view of the content types the server registers, one type
 * per URL. Data comes from `mockSchemaDocument`; the page gates on
 * `content:read`.
 */
export class ContentModelPage extends BasePage {
    /** The page's `<h1>`, present in every state. */
    readonly heading: Locator;
    /** The Content Model entry in the primary nav. */
    readonly navLink: Locator;
    /** The skeleton's one announced region. */
    readonly loading: Locator;
    /** The rail of types. */
    readonly rail: Locator;
    /** The failed-load alert. */
    readonly errorAlert: Locator;
    /** The alert's retry button. */
    readonly retryButton: Locator;

    constructor(page: Page) {
        super(page);
        this.heading = page.getByRole('heading', {
            name: 'Content Model',
            level: 1
        });
        this.navLink = page
            .getByRole('navigation', { name: 'Primary' })
            .getByRole('link', { name: 'Content Model' });
        this.loading = page
            .getByRole('status')
            .filter({ hasText: 'Loading the content model…' });
        this.rail = page.getByRole('navigation', { name: 'Content types' });
        this.errorAlert = page
            .getByRole('alert')
            .filter({ hasText: 'Couldn’t load the content model' });
        this.retryButton = this.errorAlert.getByRole('button', {
            name: 'Retry'
        });
    }

    /** Open the page, optionally on one type. */
    async goto(typeName?: string) {
        await this.page.goto(
            typeName ? `/content-model/${typeName}` : '/content-model'
        );
    }

    /** One type's link in the rail. */
    railLink(label: string): Locator {
        return this.rail.getByRole('link', { name: new RegExp(`^${label}`) });
    }

    /** The rail link marked as the current page. */
    currentRailLink(): Locator {
        return this.rail.locator('[aria-current="page"]');
    }

    /** The selected type's heading. */
    typeHeading(label: string): Locator {
        return this.page.getByRole('heading', { name: label, level: 2 });
    }

    /** One built-in tab's block (General, Relations, Media). */
    tab(name: 'General' | 'Relations' | 'Media'): Locator {
        return this.page.getByRole('region', { name });
    }

    /** The machine names of the fields drawn on a tab, top to bottom. */
    async fieldNames(
        name: 'General' | 'Relations' | 'Media'
    ): Promise<string[]> {
        const rows = await this.tab(name).getByRole('listitem').all();
        const names: string[] = [];
        for (const row of rows) {
            if (await row.isVisible()) {
                names.push(
                    (await row.locator('.font-mono').first().textContent()) ??
                        ''
                );
            }
        }
        return names;
    }

    /** A General-tab group's accordion trigger. */
    groupTrigger(label: string): Locator {
        return this.tab('General').getByRole('button', {
            name: new RegExp(label)
        });
    }

    /** The page-wide read-only notice, by a phrase in it. */
    notice(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /** The no-access state's heading. */
    noAccessHeading(): Locator {
        return this.page.getByRole('heading', {
            name: 'You don’t have access to the content model'
        });
    }

    // --- editing ------------------------------------------------------------

    /** The fields card's "Add field" button. */
    addFieldButton(): Locator {
        return this.page.getByRole('button', { name: 'Add field' }).first();
    }

    /** The "Add a field" page's `<h1>`. */
    addFieldHeading(): Locator {
        return this.page.getByRole('heading', {
            level: 1,
            name: 'Add a field'
        });
    }

    /** One kind of field on the page's first step. */
    fieldKind(label: string): Locator {
        return this.page.getByRole('radio', { name: label, exact: true });
    }

    /** A field's sheet, named by the field. */
    fieldSheet(name: string): Locator {
        return this.page.getByRole('dialog', { name });
    }

    /** The row's own "Edit <name>" button. */
    editField(name: string): Locator {
        return this.page.getByRole('button', { name: `Edit ${name}` });
    }

    /** The drag handle that reorders a field. */
    reorderHandle(name: string): Locator {
        return this.page.getByRole('button', { name: `Reorder ${name}` });
    }

    /**
     * Moves a field one place up from its drag handle, by keyboard — waiting
     * for each announcement, because the drag only starts once the item is
     * picked up, and a key pressed before then goes nowhere.
     */
    async moveFieldUp(name: string): Promise<void> {
        const announced = (text: RegExp) =>
            this.page.getByText(text).first().waitFor({ state: 'attached' });
        await this.reorderHandle(name).focus();
        await this.page.keyboard.press('Space');
        await announced(new RegExp(`^Picked up ${name}\\.$`));
        await this.page.keyboard.press('ArrowUp');
        // Over another field — not the one it started on.
        await announced(new RegExp(`^${name} is over (?!${name}\\.)`));
        await this.page.keyboard.press('Space');
        await announced(
            new RegExp(`^(Dropped ${name}\\.|${name} stays where it is)`)
        );
    }

    /** A field's row, by its machine name. */
    fieldRow(name: string): Locator {
        return this.page
            .getByRole('listitem')
            .filter({ has: this.editField(name) });
    }

    /** The drop zone a General-tab group with no fields draws. */
    emptyGroupDropZone(label: string): Locator {
        return this.groupTrigger(label)
            .locator('xpath=..')
            .getByText(/the schema refuses an empty group/);
    }

    /**
     * Drags a field by its handle with the pointer and drops it onto `target`
     * — a field row (landing before it) or an empty list's drop zone. The row
     * is moved so its centre sits just above the target's: dnd-kit picks the
     * target by the closest centre, and the upper half means "before".
     */
    async dragField(name: string, target: Locator): Promise<void> {
        await target.scrollIntoViewIfNeeded();
        const handle = await this.reorderHandle(name).boundingBox();
        const row = await this.fieldRow(name).boundingBox();
        const to = await target.boundingBox();
        if (!handle || !row || !to)
            throw new Error(`Cannot drag ${name}: not on screen`);
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        const dy = to.y + to.height / 2 - (row.y + row.height / 2) - 4;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        // Past the 4px activation distance first, so the drag starts.
        await this.page.mouse.move(x, y + (dy < 0 ? -8 : 8), { steps: 4 });
        await this.page.mouse.move(x, y + dy, { steps: 16 });
        await this.page.mouse.move(x, y + dy + 1);
        await this.page.mouse.up();
    }

    /**
     * Moves a field one step by keyboard from its handle — into another list
     * when that is the nearest row that way — waiting for the announcement
     * that says where it is (`over`) before dropping it.
     */
    async moveFieldByKeyboard(
        name: string,
        key: 'ArrowUp' | 'ArrowDown',
        over: RegExp
    ): Promise<void> {
        const announced = (text: RegExp) =>
            this.page.getByText(text).first().waitFor({ state: 'attached' });
        await this.reorderHandle(name).focus();
        await this.page.keyboard.press('Space');
        await announced(new RegExp(`^Picked up ${name}\\.$`));
        await this.page.keyboard.press(key);
        await announced(over);
        await this.page.keyboard.press('Space');
    }

    /** A drag-and-drop announcement, as screen readers hear it. */
    announcement(text: RegExp): Locator {
        return this.page.getByText(text).first();
    }

    /** The General block's "Groups" button. */
    groupsButton(): Locator {
        return this.tab('General').getByRole('button', { name: 'Groups' });
    }

    /** The groups sheet. */
    groupsSheet(): Locator {
        return this.page.getByRole('dialog', {
            name: 'Groups on the General tab'
        });
    }

    /** The header's unsaved-change count. */
    changeCount(): Locator {
        return this.page.getByText(/\d+ unsaved changes?/);
    }

    /** The header's "Discard changes". */
    discardButton(): Locator {
        return this.page.getByRole('button', { name: 'Discard changes' });
    }

    /** A field row's actions menu trigger. */
    fieldMenu(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** An item of the open menu. */
    menuItem(name: string): Locator {
        return this.page.getByRole('menuitem', { name });
    }

    /** An option of the open select. */
    option(name: string): Locator {
        return this.page.getByRole('option', { name });
    }

    /** A destination in the app's primary nav. */
    primaryNavLink(name: string): Locator {
        return this.page
            .getByRole('navigation', { name: 'Primary' })
            .getByRole('link', { name });
    }

    /** The app's unsaved-changes confirm. */
    unsavedChangesDialog(): Locator {
        return this.page.getByRole('dialog', {
            name: 'Discard your unsaved changes?'
        });
    }

    /** The rail's "New content type". */
    newTypeButton(): Locator {
        return this.rail.getByRole('button', { name: 'New content type' });
    }

    /** The header's "Review changes". */
    reviewButton(): Locator {
        return this.page.getByRole('button', { name: 'Review changes' });
    }

    /** The review page's `<h1>`. */
    reviewHeading(): Locator {
        return this.page.getByRole('heading', {
            level: 1,
            name: 'Review changes'
        });
    }

    /** The heading of the review step (or apply outcome) on screen. */
    stepHeading(name: string): Locator {
        return this.page.getByRole('heading', { level: 2, name });
    }

    /** A button on the review page, by its name. */
    reviewAction(name: string): Locator {
        return this.page.getByRole('button', { name, exact: true });
    }

    /** "Back to the Content Model" — a link while reviewing, a button after an apply. */
    backToModel(): Locator {
        return this.page
            .getByRole('link', { name: 'Back to the Content Model' })
            .or(
                this.page.getByRole('button', {
                    name: 'Back to the Content Model'
                })
            );
    }

    /** Walks the review from the changes to the apply step. */
    async continueToApply(): Promise<void> {
        await this.reviewAction('Continue to files').click();
        await this.reviewAction('Continue to apply').click();
        await this.stepHeading('Apply').waitFor();
    }

    /** The after-apply offer to grant a new type to workspaces. */
    grantDialog(): Locator {
        return this.page.getByRole('dialog', {
            name: /^Use the new types? in workspaces$/
        });
    }

    /** The empty state of a type with no fields, and its way in. */
    addFirstFieldButton(): Locator {
        return this.page.getByRole('button', { name: 'Add the first field' });
    }

    /**
     * Adds a collection from the rail, by its label, and — since a type needs
     * a field before it can be reviewed — a short text field named Title.
     */
    async addType(
        label: string,
        { firstField = true }: { firstField?: boolean } = {}
    ): Promise<void> {
        await this.newTypeButton().click();
        const dialog = this.page.getByRole('dialog', {
            name: 'New content type'
        });
        await dialog.getByLabel('Label').fill(label);
        await dialog.getByRole('button', { name: 'Add type' }).click();
        if (!firstField) return;
        await this.addFirstFieldButton().click();
        await this.reviewAction('Continue').click();
        await this.page.getByLabel('Label').fill('Title');
        await this.reviewAction('Continue').click();
        await this.reviewAction('Add field').click();
        await this.reviewButton().waitFor();
    }

    /** The empty state's heading. */
    emptyHeading(): Locator {
        return this.page.getByRole('heading', { name: 'No content types yet' });
    }
}
