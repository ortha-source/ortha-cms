import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the **rich-text field** — the WYSIWYG plugin's
 * (`@ortha-cms/wysiwyg-admin`) `ENTRY_FIELD_CONTROL_SLOT` contribution: a
 * preview of the stored content in the entry form, opening into a TipTap editor
 * dialog with the formatting toolbar.
 *
 * Seed with `mockSignedIn`, `mockWorkspaces`, and the `WYSIWYG_*` content mocks
 * (their schema is what makes the plugin claim the field), plus `spyEntrySave`
 * for anything that asserts the HTML actually stored.
 */
export class WysiwygFieldPage extends BasePage {
    /** The editor dialog, named by the field it belongs to. */
    readonly dialog: Locator;
    /** The dialog's toolbar. */
    readonly toolbar: Locator;

    constructor(page: Page) {
        super(page);
        this.dialog = page.getByRole('dialog');
        this.toolbar = page.getByRole('group', { name: 'Formatting' });
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

    /** Open a field's editor dialog and wait for the toolbar to arrive. */
    async open(label: string): Promise<void> {
        await this.control(label).click();
        await this.toolbar.waitFor();
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

    /** Open one of the toolbar's dropdowns (e.g. "Callout", "Table"). */
    async openToolbarMenu(name: string): Promise<void> {
        await this.toolbarButton(name).click();
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

    /** Close the dialog via its footer action. */
    async done(): Promise<void> {
        await this.page.getByRole('button', { name: 'Done' }).click();
        await this.dialog.waitFor({ state: 'hidden' });
    }
}
