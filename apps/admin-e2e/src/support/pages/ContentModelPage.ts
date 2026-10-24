import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the content model (`@orthacms/schema-builder-admin`) — the
 * global, read-only view of the content types the server registers, one type
 * per URL. Data comes from `mockSchemaDocument`; the page gates on
 * `content:read`.
 */
export class ContentModelPage extends BasePage {
    /**
     * The page's `<h1>`, present in every state: "Content Model" while loading,
     * on an error, an empty model or without access — the open type's label
     * once a type is on screen.
     */
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
        this.heading = page.getByRole('heading', { level: 1 });
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

    /** The selected type's heading — the page's `<h1>`. */
    typeHeading(label: string): Locator {
        return this.page.getByRole('heading', { name: label, level: 1 });
    }

    /** The type's field list, groups included. */
    fields(): Locator {
        return this.page.getByRole('region', { name: 'Fields' });
    }

    /**
     * A block the field list no longer draws: since ADR-0022 relations and
     * media are fields of the one form, so a spec asserts these are gone.
     */
    block(name: 'Relations' | 'Media' | 'Content'): Locator {
        return this.page.getByRole('region', { name, exact: true });
    }

    /** The type header's Settings button, and the sheet it opens. */
    settingsButton(): Locator {
        return this.page.getByRole('button', { name: 'Settings', exact: true });
    }

    settingsSheet(): Locator {
        return this.page.getByRole('dialog', { name: /settings$/ });
    }

    /** The rail's search. */
    railSearch(): Locator {
        return this.rail.getByRole('searchbox', { name: 'Find a type' });
    }

    /** The machine names of the fields in the list, top to bottom. */
    async fieldNames(): Promise<string[]> {
        const rows = await this.fields().getByRole('listitem').all();
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

    /** A General-tab group's block: its trigger, its handle and its fields. */
    groupBlock(label: string): Locator {
        return this.fields().getByRole('group', {
            name: label,
            exact: true
        });
    }

    /** A General-tab group's accordion trigger. */
    groupTrigger(label: string): Locator {
        return this.groupBlock(label).getByRole('button', {
            name: new RegExp(`^${label}`)
        });
    }

    /** The labels of the General tab's groups, top to bottom. */
    async groupNames(): Promise<string[]> {
        const blocks = await this.fields().getByRole('group').all();
        const labels: string[] = [];
        for (const block of blocks)
            labels.push((await block.getAttribute('aria-label')) ?? '');
        return labels;
    }

    /** A General-tab group's "Actions for the group …" menu button. */
    groupMenu(label: string): Locator {
        return this.page.getByRole('button', {
            name: `Actions for the group ${label}`,
            exact: true
        });
    }

    /** One group's own sheet, opened from its menu. */
    groupSheet(label: string): Locator {
        return this.page.getByRole('dialog', { name: `Group ${label}` });
    }

    /** The drag handle that reorders a General-tab group. */
    groupReorderHandle(label: string): Locator {
        return this.page.getByRole('button', {
            name: `Reorder the group ${label}`,
            exact: true
        });
    }

    /** The machine names of the fields drawn inside one group, top to bottom. */
    async groupFieldNames(label: string): Promise<string[]> {
        const rows = await this.groupBlock(label).getByRole('listitem').all();
        const names: string[] = [];
        for (const row of rows)
            names.push(
                (await row.locator('.font-mono').first().textContent()) ?? ''
            );
        return names;
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

    /** The field list's "Add field" button. */
    addFieldButton(): Locator {
        return this.fields().getByRole('button', { name: 'Add field' });
    }

    /** The "Add a field to …" kind picker. */
    addFieldDialog(): Locator {
        return this.page.getByRole('dialog', { name: /^Add a field to / });
    }

    /** One kind of field in the picker. */
    fieldKind(label: string): Locator {
        return this.page.getByRole('radio', { name: label, exact: true });
    }

    /**
     * A field's panel, named by its label — which, without one, is its
     * machine name in words (`publishDate` → "Publish date").
     */
    fieldSheet(name: string): Locator {
        return this.page.getByRole('dialog', { name });
    }

    /** The panel of a field being added, before it has a name. */
    newFieldSheet(): Locator {
        return this.page.getByRole('dialog', { name: 'New field' });
    }

    /**
     * Adds a field: picks its kind (the first, Short text, unless named),
     * gives it a label, and adds it from its panel.
     */
    async addField(
        label: string,
        { kind, from }: { kind?: string; from?: Locator } = {}
    ): Promise<void> {
        await (from ?? this.addFieldButton()).click();
        if (kind) await this.fieldKind(kind).click();
        await this.addFieldDialog()
            .getByRole('button', { name: 'Continue' })
            .click();
        await this.newFieldSheet().getByLabel('Label').fill(label);
        await this.page
            .getByRole('dialog')
            .getByRole('button', { name: 'Add field' })
            .click();
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
        return this.groupBlock(label).getByText(
            /the schema refuses an empty group/
        );
    }

    /**
     * Drags a field by its handle with the pointer and drops it onto `target`
     * — a field row (landing before it) or an empty list's drop zone. The row
     * is moved so its centre sits just above the target's: dnd-kit picks the
     * target by the closest centre, and the upper half means "before".
     */
    async dragField(name: string, target: Locator): Promise<void> {
        await this.startDrag(
            this.reorderHandle(name),
            this.fieldRow(name),
            target
        );
        await this.page.mouse.up();
    }

    /**
     * Picks up `handle` with the pointer and holds `row` over `target`
     * without dropping it, so a spec can look at the page mid-drag; the
     * caller lets go with `page.mouse.up()`.
     */
    async startDrag(
        handle: Locator,
        row: Locator,
        target: Locator
    ): Promise<void> {
        await target.scrollIntoViewIfNeeded();
        const grip = await handle.boundingBox();
        const box = await row.boundingBox();
        const to = await target.boundingBox();
        if (!grip || !box || !to) throw new Error('Cannot drag: not on screen');
        const x = grip.x + grip.width / 2;
        const y = grip.y + grip.height / 2;
        const dy = to.y + to.height / 2 - (box.y + box.height / 2) - 4;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        // Past the 4px activation distance first, so the drag starts.
        await this.page.mouse.move(x, y + (dy < 0 ? -8 : 8), { steps: 4 });
        await this.page.mouse.move(x, y + dy, { steps: 16 });
        await this.page.mouse.move(x, y + dy + 1);
    }

    /**
     * Drags a General-tab group by its handle onto the group `target`'s
     * handle — where a person aims, whatever the two blocks' heights.
     */
    async dragGroup(label: string, target: string): Promise<void> {
        await this.startDrag(
            this.groupReorderHandle(label),
            this.groupReorderHandle(label),
            this.groupReorderHandle(target)
        );
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

    /** The field list's "+ Group" button, which opens the groups sheet. */
    groupsButton(): Locator {
        return this.fields().getByRole('button', { name: 'Add a group' });
    }

    /** A select field's option input in its sheet's Validation tab, 1-based. */
    selectOption(sheet: Locator, index: number): Locator {
        return sheet.getByRole('textbox', {
            name: `Option ${index}`,
            exact: true
        });
    }

    /** The "Remove <option>" button beside a select's option. */
    removeSelectOption(sheet: Locator, option: string): Locator {
        return sheet.getByRole('button', {
            name: `Remove ${option}`,
            exact: true
        });
    }

    /** The select's "New option" input. */
    newSelectOption(sheet: Locator): Locator {
        return sheet.getByRole('textbox', { name: 'New option' });
    }

    /** The groups sheet. */
    groupsSheet(): Locator {
        return this.page.getByRole('dialog', {
            name: 'Groups on the Content tab'
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

    /** The review page's `<h1>` ("Review 3 changes"). */
    reviewHeading(): Locator {
        return this.page.getByRole('heading', {
            level: 1,
            name: /^Review \d+ changes?$/
        });
    }

    /** The `<h1>` of the review's later states: applying, failed, applied. */
    outcomeHeading(name: string | RegExp): Locator {
        return this.page.getByRole('heading', { level: 1, name });
    }

    /** One type's card of changes on the review page. */
    changeGroup(label: string): Locator {
        return this.page.getByRole('region', { name: label, exact: true });
    }

    /** The review's "Apply N changes" (the base's `applyButton` is the filter's). */
    applyChangesButton(): Locator {
        return this.page.getByRole('button', { name: /^Apply \d/ });
    }

    /** The folded "Technical details" — files and SQL. */
    technicalDetails(): Locator {
        return this.page.getByRole('button', { name: /^Technical details/ });
    }

    /** The apply's steps while it runs. */
    applySteps(): Locator {
        return this.page.getByRole('status').getByRole('listitem');
    }

    /** A button on the review page, by its name. */
    reviewAction(name: string): Locator {
        return this.page.getByRole('button', { name, exact: true });
    }

    /** Back to the editor — "Back to editing" while reviewing, "Back to the Content Model" after an apply. */
    backToModel(): Locator {
        return this.page.getByRole('link', { name: 'Back to editing' }).or(
            this.page.getByRole('button', {
                name: 'Back to the Content Model'
            })
        );
    }

    /** The applied page's offer to use the new types in workspaces. */
    grantCard(): Locator {
        return this.page.getByRole('region', {
            name: /^Use .+ in workspaces$/
        });
    }

    /** The empty state of a type with no fields, and its way in. */
    addFirstFieldButton(): Locator {
        return this.page.getByRole('button', { name: 'Add the first field' });
    }

    /** The "New content type" dialog. */
    newTypeDialog(): Locator {
        return this.page.getByRole('dialog', { name: 'New content type' });
    }

    /**
     * Adds a blank collection from the rail, by its name, and — since a type
     * needs a field before it can be reviewed — a short text field named
     * Title.
     */
    async addType(
        label: string,
        { firstField = true }: { firstField?: boolean } = {}
    ): Promise<void> {
        await this.newTypeButton().click();
        const dialog = this.newTypeDialog();
        await dialog.getByLabel('Name', { exact: true }).fill(label);
        await dialog.getByRole('button', { name: 'Create type' }).click();
        if (!firstField) return;
        await this.addField('Title', { from: this.addFirstFieldButton() });
        await this.reviewButton().waitFor();
    }

    /** The empty state's heading. */
    emptyHeading(): Locator {
        return this.page.getByRole('heading', { name: 'No content types yet' });
    }
}
