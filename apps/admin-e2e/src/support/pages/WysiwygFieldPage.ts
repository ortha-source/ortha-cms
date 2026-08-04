import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the entry editor's **`wysiwyg` field** — the block editor from
 * `@ortha-cms/wysiwyg-admin`: a preview card in the form that expands to take
 * over the whole work area, the persistent toolbar, the slash menu, per-block
 * menus, tables, and the image block's media-library trigger.
 *
 * Seed with `mockSignedIn`, `mockWorkspaces`, the `WYSIWYG_*` content mocks
 * (their schema is what puts the field on the General tab), and — for the image
 * block's library trigger — `mockMediaApi`.
 *
 * Two things worth knowing before adding a case here:
 *
 * - **The expanded editor is a portal, not a modal.** The form is still in the
 *   DOM (hidden), so a locator for a form field resolves either way — assert
 *   visibility, never presence.
 * - **Every block is its own `role="textbox"`**, named after its type ("Text
 *   block", "Heading 1", "Row 2, column 1"). There is no single editable to
 *   fill, which is why {@link block} takes an index.
 */
export class WysiwygFieldPage extends BasePage {
    /** The expanded editor's region — `<label> — editing`. */
    readonly region: Locator;
    /** The block editor itself, inside the region. */
    readonly editor: Locator;
    /** The persistent toolbar, shown only when the editor owns the work area. */
    readonly toolbar: Locator;
    /** The slash command palette. */
    readonly slashMenu: Locator;

    constructor(page: Page) {
        super(page);
        this.region = page.getByRole('region', { name: 'Body — editing' });
        this.editor = page.getByRole('group', { name: 'Rich text editor' });
        this.toolbar = page.getByRole('toolbar', { name: 'Editor toolbar' });
        this.slashMenu = page.getByRole('listbox');
    }

    /** Open the create editor for the seeded `article` collection. */
    async gotoNewArticle(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/content/article/new`);
    }

    /** Open an existing record's editor. */
    async gotoArticle(workspaceId: string, entryId: string) {
        await this.page.goto(
            `/workspaces/${workspaceId}/content/article/${entryId}`
        );
    }

    // --- the form side -------------------------------------------------------

    /**
     * The field's preview card — a button naming the document's own title, or
     * the field label until the document has a heading.
     */
    previewCard(title = 'Body'): Locator {
        return this.page.getByRole('button', {
            name: `Open ${title} in the full editor`
        });
    }

    /** The preview's empty state, before anything is written. */
    get previewEmpty(): Locator {
        return this.page.getByText('Nothing written yet');
    }

    /** The word count beside the label, in the form and in the editor header. */
    wordCount(text: string): Locator {
        return this.page.getByText(text, { exact: true });
    }

    /**
     * The field's validation message **in the form**. Scoped, because the same
     * sentence also appears in the Properties rail's publish gate — a strict
     * locator would match both.
     */
    fieldError(message: string | RegExp): Locator {
        return this.page.getByLabel('General').getByText(message);
    }

    /** The record title input — required, so a save needs it filled. */
    get title(): Locator {
        return this.page.getByRole('textbox', { name: 'Title' });
    }

    /** The editor's primary action (label varies by type/state). */
    get save(): Locator {
        return this.page.getByRole('button', {
            name: /^(Save|Save draft|Save & publish|Publish)$/
        });
    }

    /** Expand the field into the work area. */
    async expand() {
        await this.previewCard().click();
        await this.editor.waitFor();
    }

    /** Collapse back to the form via the header's Done button. */
    async collapse() {
        await this.page.getByRole('button', { name: 'Done' }).click();
        await this.editor.waitFor({ state: 'hidden' });
    }

    // --- blocks --------------------------------------------------------------

    /**
     * One block's editable, by position among blocks of that type. Blocks are
     * named after what they are, so `block('Text block', 1)` is the second
     * paragraph.
     */
    block(name: string, index = 0): Locator {
        return this.editor.getByRole('textbox', { name }).nth(index);
    }

    /** Every block row's rendered text, in document order. */
    async blockTexts(): Promise<string[]> {
        return this.editor.locator('[data-block-path]').allInnerTexts();
    }

    /** Type into a block, placing the caret at its end first. */
    async typeInto(block: Locator, text: string) {
        await block.click();
        await this.page.keyboard.press('End');
        await this.page.keyboard.type(text);
    }

    /** Type at the caret, wherever it currently is. */
    async type(text: string) {
        await this.page.keyboard.type(text);
    }

    /** Press a key at the caret (`Enter`, `Tab`, `Escape`, `ControlOrMeta+b`). */
    async press(key: string) {
        await this.page.keyboard.press(key);
    }

    /**
     * Write a run of paragraphs from the first block down, one Enter apart —
     * the setup every block-selection case needs.
     */
    async writeParagraphs(...texts: readonly string[]) {
        await this.block('Text block').click();
        for (const [index, text] of texts.entries()) {
            if (index > 0) await this.press('Enter');
            await this.type(text);
        }
    }

    /** ⌘A from inside the editor — promotes the caret to every block. */
    async selectAllBlocks() {
        await this.press('ControlOrMeta+a');
    }

    /** The blocks currently selected as whole units (the block selection). */
    get selectedBlocks(): Locator {
        return this.editor.locator('[data-selected]');
    }

    /**
     * Drag from one block row to another — the gesture that selects a run. The
     * browser's own selection stops at the first block, so this is the only way
     * to select across them.
     */
    async dragSelect(from: number, to: number) {
        const rows = this.editor.locator('[data-block-path]');
        const start = await rows.nth(from).boundingBox();
        const end = await rows.nth(to).boundingBox();
        if (!start || !end) throw new Error('block row is not laid out');
        await this.page.mouse.move(start.x + 60, start.y + start.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.move(end.x + 60, end.y + end.height / 2, {
            steps: 10
        });
        await this.page.mouse.up();
    }

    // --- the menus -----------------------------------------------------------

    /** Open the slash menu in `block` and filter it to `query`. */
    async runSlash(block: Locator, query: string) {
        await block.click();
        await this.page.keyboard.press('End');
        await this.page.keyboard.type(`/${query}`);
        await this.slashMenu.waitFor();
    }

    /** Insert a block type through the slash menu, from the first block. */
    async insertViaSlash(query: string, option: string) {
        await this.runSlash(this.block('Text block'), query);
        await this.slashOption(option).click();
    }

    /** A slash-menu option, by its label. */
    slashOption(label: string): Locator {
        return this.slashMenu.getByRole('option', { name: label });
    }

    // --- alignment, colour and size ------------------------------------------

    /** An alignment toggle in the toolbar. */
    alignButton(
        name: 'Align left' | 'Align centre' | 'Align right' | 'Justify'
    ): Locator {
        return this.toolbar.getByRole('button', { name });
    }

    /** The colour/highlight dropdown trigger. */
    get colorTrigger(): Locator {
        return this.toolbar.getByRole('button', {
            name: 'Text colour and highlight'
        });
    }

    /**
     * Pick a palette entry. The menu lists every colour twice — text first,
     * highlight second — so `section` says which run is meant.
     */
    async pickColor(section: 'text' | 'highlight', name: string) {
        await this.colorTrigger.click();
        const option = this.page.getByRole('menuitem', { name });
        await (section === 'text' ? option.first() : option.last()).click();
        await this.page.getByRole('menu').waitFor({ state: 'hidden' });
    }

    /** The link popover's URL field (the persistent toolbar's, not the floating one). */
    get linkUrl(): Locator {
        return this.page.getByRole('textbox', { name: 'Link URL' });
    }

    /** Apply a URL through the toolbar's link popover. */
    async applyLink(url: string) {
        await this.toolbar.getByRole('button', { name: 'Link' }).click();
        await this.linkUrl.fill(url);
        await this.linkUrl.press('Enter');
    }

    /** Open the link popover and remove the link under the caret. */
    async removeLink() {
        await this.toolbar.getByRole('button', { name: 'Link' }).click();
        await this.page.getByRole('button', { name: 'Remove link' }).click();
    }

    /** Set a custom colour through the palette's colour well. */
    async pickCustomColor(section: 'text' | 'highlight', hex: string) {
        await this.colorTrigger.click();
        const wells = this.page.locator('input[type=color]');
        const well = section === 'text' ? wells.first() : wells.last();
        // A colour well opens the OS picker, which a driver cannot enter — so
        // the value is set and its `input` event fired, which is exactly what
        // the picker itself dispatches.
        await well.evaluate((element, value) => {
            (element as HTMLInputElement).value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        }, hex);
        await this.page.keyboard.press('Escape');
    }

    /** Whether a toolbar control shows a tooltip naming it. */
    async tooltipFor(name: string): Promise<string> {
        await this.toolbar.getByRole('button', { name }).first().hover();
        await this.page
            .waitForFunction(
                () =>
                    (
                        document.querySelector('[role=tooltip]')?.textContent ??
                        ''
                    ).length > 0,
                null,
                { timeout: 3000 }
            )
            .catch(() => undefined);
        return (
            (await this.page
                .locator('[role=tooltip]')
                .first()
                .textContent()
                .catch(() => '')) ?? ''
        );
    }

    /** An image block's width preset button. */
    imageWidth(name: 'Small' | 'Medium' | 'Large' | 'Full'): Locator {
        return this.editor.getByRole('button', { name, exact: true });
    }

    /** An image's resize grip, on one edge or the other. */
    imageResizer(side: 'left' | 'right'): Locator {
        return this.editor.getByRole('button', {
            name: `Resize image from the ${side}`
        });
    }

    /**
     * Select a whole block's text. `Home` first: a click lands the caret where
     * the pointer is, which for a short line is already the end — so Shift+End
     * on its own selects nothing.
     */
    async selectLine(blockName: string) {
        await this.block(blockName).click();
        await this.press('Home');
        await this.page.keyboard.down('Shift');
        await this.press('End');
        await this.page.keyboard.up('Shift');
    }

    /** A toolbar control, by its accessible name. */
    toolbarButton(name: string): Locator {
        return this.toolbar.getByRole('button', { name });
    }

    /** The toolbar's block-type trigger ("turn the current block into…"). */
    get turnInto(): Locator {
        return this.toolbar.getByRole('button', {
            name: 'Turn the current block into…'
        });
    }

    /** An open dropdown's item, by label. */
    menuItem(name: string): Locator {
        return this.page.getByRole('menuitem', { name });
    }

    /**
     * Choose a dropdown item **and wait for the menu to go away**. Radix marks
     * the rest of the page `aria-hidden` while a menu is open, which makes every
     * role-based locator here (the editor itself included) resolve to nothing —
     * so reading the document straight after a click races the close.
     */
    async chooseMenuItem(name: string) {
        await this.menuItem(name).click();
        await this.menusClosed();
    }

    /**
     * Open a submenu and choose an item from it.
     *
     * Not `chooseMenuItem` twice: hovering the trigger leaves **two** menus in
     * the DOM, so waiting on `getByRole('menu')` between them resolves to more
     * than one element and throws before anything is clicked.
     */
    async chooseSubMenuItem(trigger: string, name: string) {
        await this.menuItem(trigger).hover();
        await this.menuItem(name).click();
        await this.menusClosed();
    }

    /** Wait until no dropdown is left open. */
    async menusClosed() {
        await expect(this.page.getByRole('menu')).toHaveCount(0);
    }

    // --- tables --------------------------------------------------------------

    /** A table cell's editable, by its 1-based row and column. */
    cell(row: number, column: number): Locator {
        return this.editor.getByRole('textbox', {
            name: `Row ${row}, column ${column}`
        });
    }

    /** The handle above one column (1-based), opening its insert/delete menu. */
    columnMenu(index: number): Locator {
        return this.editor.getByRole('button', {
            name: `Column ${index} options`
        });
    }

    /** The handle beside one row (1-based). */
    rowMenu(index: number): Locator {
        return this.editor.getByRole('button', {
            name: `Row ${index} options`
        });
    }

    /** The table's header-row toggle. */
    get headerRowToggle(): Locator {
        return this.editor.getByRole('button', { name: 'Header row' });
    }

    /**
     * Every cell's text, row by row — the grid as the author sees it. Only
     * cells holding an editable count: the table also renders a control row and
     * a control column for the handles, and a test asserting a table's shape
     * means the shape of its **content**.
     */
    async grid(): Promise<string[][]> {
        const rows = this.editor.locator('table tr');
        const grid: string[][] = [];
        for (let row = 0; row < (await rows.count()); row += 1) {
            const texts = await rows
                .nth(row)
                .locator('th, td')
                .filter({ has: this.page.locator('[role="textbox"]') })
                .allInnerTexts();
            if (texts.length > 0) grid.push(texts.map((text) => text.trim()));
        }
        return grid;
    }

    /** Insert a table from the slash menu and wait for its first cell. */
    async insertTable() {
        await this.insertViaSlash('table', 'Table');
        await this.cell(1, 1).waitFor();
    }

    // --- column layouts ------------------------------------------------------

    /** Insert a column layout from the slash menu. */
    async insertColumns() {
        await this.insertViaSlash('column', 'Columns');
        await this.column(2).waitFor();
    }

    /** One column of a layout, 1-based. */
    column(position: number): Locator {
        return this.editor.getByRole('group', { name: `Column ${position}` });
    }

    /** A block inside one column, by position among that column's blocks. */
    columnBlock(position: number, index = 0): Locator {
        return this.column(position).getByRole('textbox').nth(index);
    }

    /** How many blocks a column holds. */
    async columnBlockCount(position: number): Promise<number> {
        return this.column(position).getByRole('textbox').count();
    }

    /** The travelling gutter's "add a block" control. */
    get gutterAdd(): Locator {
        return this.page.getByRole('button', { name: 'Add a block below' });
    }

    /**
     * Park the gutter on `block`, then walk the pointer onto it the way a hand
     * would — in steps, crossing whatever lies in between.
     *
     * A single jump straight to the controls proves nothing: the gutter hangs
     * off the **left** of the block it acts on, so inside a column it sits over
     * the column beside it, and the bug being guarded against is that every row
     * crossed on the way there re-parks it somewhere else.
     */
    async reachForGutter(block: Locator) {
        const box = await block.boundingBox();
        if (!box) throw new Error('the block is not laid out');
        const y = box.y + box.height / 2;
        await this.page.mouse.move(box.x + 40, y);
        const gutter = await this.gutterAdd.boundingBox();
        if (!gutter) throw new Error('the gutter never appeared');
        const target = gutter.x + gutter.width / 2;
        for (let x = box.x + 40; x > target; x -= 6) {
            await this.page.mouse.move(x, y);
        }
        await this.page.mouse.move(target, gutter.y + gutter.height / 2);
    }

    /** The computed left border of an element, in pixels. */
    async borderLeftOf(locator: Locator): Promise<number> {
        return locator.evaluate((element) =>
            parseFloat(getComputedStyle(element).borderLeftWidth)
        );
    }

    /** The table block itself — the alignment controls share names with the
     * toolbar's, and only the table's belong to the table. */
    get table(): Locator {
        return this.editor.getByRole('group', { name: 'Table' });
    }

    /** The table's own alignment button, beside the table. */
    tableAlign(name: 'Align left' | 'Align centre' | 'Align right'): Locator {
        return this.table.getByRole('button', { name, exact: true });
    }

    /** A column's resize grip (1-based). */
    columnResizer(index: number): Locator {
        return this.editor.getByRole('button', {
            name: `Resize column ${index}`
        });
    }

    /**
     * Every column's rendered width, in pixels — the editor's own row-handle
     * column dropped, so the indices line up with the model's columns.
     */
    async columnWidths(): Promise<number[]> {
        return this.editor
            .locator('table tr')
            .nth(1)
            .evaluate((row, columns: number) => {
                const cells = Array.from(row.children).filter(
                    (cell) => cell.tagName === 'TH' || cell.tagName === 'TD'
                );
                return cells
                    .slice(cells.length - columns)
                    .map((cell) => cell.getBoundingClientRect().width);
            }, 3);
    }

    /** The grip on the table's own right edge. */
    get tableResizer(): Locator {
        return this.editor.getByRole('button', { name: 'Resize table' });
    }

    /** Click a raw viewport point, when the target is a region and not a role. */
    async clickAt(x: number, y: number) {
        await this.page.mouse.click(x, y);
    }

    /**
     * A short description of whatever element is topmost at a point — the only
     * way to ask "what would a click here actually hit", which is a different
     * question from "what is laid out here".
     */
    async topmostAt(x: number, y: number): Promise<string> {
        return this.page.evaluate(
            ([atX, atY]) => {
                const element = document.elementFromPoint(atX, atY);
                if (!element) return 'nothing';
                const label = element.getAttribute('aria-label');
                return label ? `${element.tagName}[${label}]` : element.tagName;
            },
            [x, y]
        );
    }

    /**
     * Drag a grip by `dx` pixels. Three moves rather than one: a `pointermove`
     * straight to the target can be dispatched before the handler that
     * `setPointerCapture` installed is listening, and the drag then does
     * nothing at all.
     */
    async dragBy(grip: Locator, dx: number) {
        const box = await grip.boundingBox();
        if (!box) throw new Error('the grip is not on screen');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await this.page.mouse.move(x, y);
        await this.page.mouse.down();
        for (const step of [0.3, 0.7, 1]) {
            await this.page.mouse.move(x + dx * step, y);
        }
        await this.page.mouse.up();
    }

    /**
     * The space left and right of `child` inside `parent`, in pixels.
     *
     * Centring is an *outcome*: the markup says `data-align="center"` however it
     * was implemented, and which element ends up carrying the margins is an
     * implementation detail that has already changed once. Measuring the gaps
     * asks the only question that matters — is the picture in the middle.
     */
    async gapsWithin(child: string, parent: string): Promise<[number, number]> {
        const inner = await this.editor.locator(child).first().boundingBox();
        const outer = await this.editor.locator(parent).first().boundingBox();
        if (!inner || !outer) throw new Error('not laid out');
        return [
            inner.x - outer.x,
            outer.x + outer.width - (inner.x + inner.width)
        ];
    }

    /** The computed width of an element, in pixels. */
    async widthOf(selector: string): Promise<number> {
        return this.editor
            .locator(selector)
            .first()
            .evaluate((element) => element.getBoundingClientRect().width);
    }

    /** The computed `text-align` of an element. */
    async textAlignOf(selector: string): Promise<string> {
        return this.editor
            .locator(selector)
            .first()
            .evaluate((element) => getComputedStyle(element).textAlign);
    }

    /** The empty image block's URL box. */
    get imageUrl(): Locator {
        return this.editor.getByRole('textbox', { name: 'Image URL' });
    }

    /** The empty image block's confirm button. */
    get addImage(): Locator {
        return this.editor.getByRole('button', { name: 'Add image' });
    }

    /** The image block's media-library trigger (empty state). */
    get chooseFromLibrary(): Locator {
        return this.editor.getByRole('button', { name: 'Choose from library' });
    }

    /** The same trigger once an image is placed. */
    get replaceFromLibrary(): Locator {
        return this.editor.getByRole('button', {
            name: 'Replace from library'
        });
    }

    /** The image block's alt-text field — deliberately always visible. */
    get altText(): Locator {
        return this.editor.getByRole('textbox', { name: 'Alt text' });
    }

    /** The media library picker the image block opens. */
    get pickerDialog(): Locator {
        return this.page.getByRole('dialog', { name: /^Select an? asset/ });
    }

    /** Pick one asset by file name and confirm. */
    async pickAsset(name: string) {
        await this.pickerDialog
            .getByRole('button', {
                name: new RegExp(name.replace('.', '\\.'))
            })
            .click();
        await this.pickerDialog
            .getByRole('button', { name: 'Select asset' })
            .click();
    }
}
