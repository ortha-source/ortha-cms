import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the **rich-text field** — the WYSIWYG plugin's
 * (`@ortha-cms/wysiwyg-admin`) `ENTRY_FIELD_CONTROL_SLOT` contribution: a
 * preview of the stored content in the entry form, expanding into a TipTap
 * editor that takes over the entry editor's **work area**.
 *
 * It is a view, not a dialog — so there is no `dialog` role to wait on. The
 * toolbar's arrival is the signal that the editor is up, and the record's own
 * chrome (top-bar actions, Properties rail, app sidebar) is expected to still
 * be on screen beside it.
 *
 * Seed with `mockSignedIn`, `mockWorkspaces`, and the `WYSIWYG_*` content mocks
 * (their schema is what makes the plugin claim the field), plus `spyEntrySave`
 * for anything that asserts the HTML actually stored.
 */
export class WysiwygFieldPage extends BasePage {
    /** The expanded editor's toolbar — present only while a field is expanded. */
    readonly toolbar: Locator;
    /** The entry editor's tab strip — present only while the form is showing. */
    readonly editorTabs: Locator;
    /** The record's Properties rail, in the app's third column. */
    readonly propertiesPanel: Locator;
    /** The workspace's content navigation, in the app sidebar. */
    readonly contentNav: Locator;

    constructor(page: Page) {
        super(page);
        this.toolbar = page.getByRole('group', { name: 'Formatting' });
        this.editorTabs = page.getByRole('tab', { name: 'General' });
        this.propertiesPanel = page.getByRole('complementary', {
            name: 'Properties'
        });
        this.contentNav = page.getByRole('navigation', {
            name: 'Content types'
        });
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

    /**
     * A rich-text field's control — the button laid over the preview, named
     * "Edit {label}". This is the field's focusable element, so it is also what
     * the field's `<label>` points at.
     */
    control(label: string): Locator {
        return this.page.getByRole('button', { name: `Edit ${label}` });
    }

    /**
     * The rendered preview for a field, located by walking up from its control
     * to the shared card. Used to assert the field shows *content* — a heading,
     * a list — rather than the markup that produced it.
     */
    preview(label: string): Locator {
        return this.control(label).locator('..');
    }

    /** Expand a field into the work area, and wait for the editor to arrive. */
    async open(label: string): Promise<void> {
        await this.control(label).click();
        await this.toolbar.waitFor();
    }

    /** The expanded editor's heading — the field's label, below the record's. */
    expandedHeading(label: string): Locator {
        return this.page.getByRole('heading', { name: label, exact: true });
    }

    /** A table inside the expanded editor's document. */
    get editorTable(): Locator {
        return this.page.getByRole('table');
    }

    /**
     * The editor's writing surface. It is a `textbox` named "{label} content",
     * so it never collides with the entry form's own text inputs.
     */
    surface(label: string): Locator {
        return this.page.getByRole('textbox', { name: `${label} content` });
    }

    /** Type into the editor at the caret (which opens at the end of the text). */
    async type(text: string): Promise<void> {
        await this.page.keyboard.type(text);
    }

    /** Empty the open editor — select everything, delete it. */
    async clearAll(): Promise<void> {
        await this.page.keyboard.press('ControlOrMeta+a');
        await this.page.keyboard.press('Backspace');
    }

    /** Open a field's editor the way a keyboard user would. */
    async openWithKeyboard(label: string): Promise<void> {
        await this.control(label).focus();
        await this.page.keyboard.press('Enter');
        await this.toolbar.waitFor();
    }

    /** A toolbar toggle/action by its accessible name (e.g. "Bold"). */
    toolbarButton(name: string): Locator {
        return this.toolbar.getByRole('button', { name, exact: true });
    }

    /** Open one of the toolbar's dropdowns (e.g. "Insert", "Alignment"). */
    async openToolbarMenu(name: string): Promise<void> {
        await this.toolbarButton(name).click();
    }

    /**
     * Open the **Insert** menu and step into one of its submenus ("Table",
     * "Columns", "Callout"). The block-insertion controls live behind one
     * trigger so the toolbar stays a single row.
     */
    async openInsertSubmenu(name: string): Promise<void> {
        await this.openToolbarMenu('Insert');
        await this.page.getByRole('menuitem', { name, exact: true }).click();
    }

    /**
     * How many rows the toolbar wraps onto — 1 unless the window is narrow.
     *
     * `MeasuredBar` is the shape of what the callback touches, spelled out
     * locally: this project's `tsconfig` has no `dom` lib (specs are black-box
     * and otherwise never name a DOM type), so `HTMLElement` doesn't resolve
     * here even though the callback runs in the browser.
     */
    async toolbarRowCount(): Promise<number> {
        type MeasuredBar = {
            children: ArrayLike<{
                getBoundingClientRect(): { top: number; height: number };
            }>;
        };
        return this.toolbar.evaluate((element) => {
            const bar = element as unknown as MeasuredBar;
            // Rows are grouped by vertical **centre**, not by `top`. The bar is
            // `items-center` and its children are different heights (a 32px
            // button beside a 20px separator), so same-row items have different
            // tops — counting those reports four rows for a bar that renders
            // one.
            const centres = new Set<number>();
            for (const child of Array.from(bar.children)) {
                const box = child.getBoundingClientRect();
                // Round: sub-pixel layout differences are not extra rows.
                centres.add(Math.round(box.top + box.height / 2));
            }
            return centres.size;
        });
    }

    /**
     * Open **Insert ▸ Media**, then one of its entries — the contributed
     * sources ("Media Library…", "Upload files…") or a built-in URL entry.
     */
    async openMediaSource(name: string | RegExp): Promise<void> {
        await this.openInsertSubmenu('Media');
        await this.page.getByRole('menuitem', { name }).click();
    }

    /** An image inside the expanded editor's document. */
    editorImage(alt: string | RegExp): Locator {
        return this.surfaceRoot.getByRole('img', { name: alt });
    }

    /** Every `<video>` in the expanded editor's document. */
    get editorVideos(): Locator {
        return this.surfaceRoot.locator('video');
    }

    /** The resize handle on the selected media node. */
    get resizeHandle(): Locator {
        return this.page.getByRole('button', { name: /^Resize/ });
    }

    /** The built-in "from a URL" dialog. */
    private get mediaUrlDialog(): Locator {
        return this.page.getByRole('dialog', { name: /from a URL$/ });
    }

    /** Fill the URL dialog and submit it. */
    async fillMediaUrl(url: string, alt?: string): Promise<void> {
        await this.mediaUrlDialog.getByLabel('URL').fill(url);
        if (alt !== undefined) {
            await this.mediaUrlDialog.getByLabel('Alt text').fill(alt);
        }
        await this.mediaUrlDialog
            .getByRole('button', { name: 'Insert' })
            .click();
    }

    /** The URL dialog's validation message. */
    get mediaUrlError(): Locator {
        return this.mediaUrlDialog.getByRole('alert');
    }

    /**
     * Pick one asset in the Media Library picker and confirm. The picker is
     * `@ortha-cms/media-admin`'s own — the same one a media *field* opens.
     */
    async pickLibraryAsset(name: string): Promise<void> {
        const picker = this.page.getByRole('dialog', { name: 'Select assets' });
        await picker
            .getByRole('button', { name: new RegExp(name.replace('.', '\\.')) })
            .click();
        await picker.getByRole('button', { name: 'Add selected' }).click();
        await picker.waitFor({ state: 'hidden' });
    }

    /** Nudge the focused resize handle, one arrow-key press at a time. */
    async nudgeResize(
        direction: 'ArrowLeft' | 'ArrowRight',
        times = 1
    ): Promise<void> {
        await this.resizeHandle.focus();
        for (let i = 0; i < times; i += 1) {
            await this.page.keyboard.press(direction);
        }
    }

    /** The editor's writing surface, as a plain element for content queries. */
    private get surfaceRoot(): Locator {
        return this.page.locator('[role="textbox"][aria-multiline="true"]');
    }

    /** An item inside an open toolbar dropdown. */
    menuItem(name: string): Locator {
        return this.page.getByRole('menuitem', { name, exact: true });
    }

    /** A radio item inside an open toolbar dropdown (text style, size, columns). */
    menuRadio(name: string): Locator {
        return this.page.getByRole('menuitemradio', { name, exact: true });
    }

    /**
     * A rich-text field's validation message, by the field's machine name.
     * Anchored on the id `EntryFieldInput` gives its `<FieldError>` — the bare
     * `role="alert"` is shared by every field on the form.
     */
    fieldError(fieldName: string): Locator {
        return this.page.locator(`#entry-field-${fieldName}-error`);
    }

    /** Collapse back to the form via the editor's footer action. */
    async done(): Promise<void> {
        await this.page.getByRole('button', { name: 'Done' }).click();
        await this.toolbar.waitFor({ state: 'hidden' });
    }

    /** Collapse back to the form via the editor's header link. */
    async backToFields(): Promise<void> {
        await this.page.getByRole('button', { name: 'Back to fields' }).click();
        await this.toolbar.waitFor({ state: 'hidden' });
    }
}
