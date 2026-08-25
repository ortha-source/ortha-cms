import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * The saved-view switcher in a collection's header action cluster (beside
 * Trash and Add record), plus its save dialog. Selectors only — the assertions
 * live in the specs.
 */
export class SavedViewsPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /** Open a collection's records table. */
    async goto(workspaceId: string, typeName: string, query = '') {
        await this.page.goto(
            `/workspaces/${workspaceId}/content/${typeName}${query}`
        );
    }

    /**
     * The switcher's control cluster — the trigger plus the modified-state
     * actions. Scoped, because "Reset" is also a filter-panel button and
     * "Save" is a common label on a records page.
     */
    group(): Locator {
        return this.page.getByRole('group', { name: 'View controls' });
    }

    /** The switcher button. Its label is the applied view's name, or "All records". */
    trigger(): Locator {
        return this.page.getByRole('button', { name: 'Saved views' });
    }

    /** The affordance shown instead of the switcher when nothing is saved yet. */
    saveFirstButton(): Locator {
        return this.group().getByRole('button', {
            name: 'Save current as view…'
        });
    }

    /** Open the switcher menu. */
    async open() {
        await this.trigger().click();
    }

    /** A view row in the open menu, by name. */
    menuItem(name: string): Locator {
        return this.page.getByRole('menuitem', { name });
    }

    /** The inline "Save" that overwrites the applied view. */
    saveChanges(): Locator {
        return this.group().getByRole('button', { name: 'Save', exact: true });
    }

    /** The inline "Save as new". */
    saveAsNew(): Locator {
        return this.group().getByRole('button', { name: 'Save as new' });
    }

    /** The inline "Reset", which re-applies the saved payload. */
    reset(): Locator {
        return this.group().getByRole('button', { name: 'Reset' });
    }

    /** The menu's "Set as my default" / "Clear my default" item. */
    defaultItem(cleared = false): Locator {
        return this.menuItem(
            cleared ? 'Clear my default' : 'Set as my default'
        );
    }

    /** The menu's "Delete view" item — which only asks; the dialog deletes. */
    deleteItem(): Locator {
        return this.menuItem('Delete view');
    }

    // --- the delete confirmation ---

    /** The delete confirm dialog. */
    confirmDeleteDialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Delete this view?' });
    }

    /**
     * The dialog's confirm button. Scoped to the dialog: the menu item that
     * opened it carries the same label.
     */
    confirmDelete(): Locator {
        return this.confirmDeleteDialog().getByRole('button', {
            name: 'Delete view'
        });
    }

    /** The dialog's Cancel. */
    cancelDelete(): Locator {
        return this.confirmDeleteDialog().getByRole('button', {
            name: 'Cancel'
        });
    }

    /** A toast message (sonner, portaled to the body). */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    // --- the save dialog ---

    /** The dialog itself. */
    dialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Save view' });
    }

    /** The name field. */
    nameInput(): Locator {
        return this.dialog().getByLabel('Name');
    }

    /** A visibility radio by label ("Personal" / "Shared"). */
    visibility(label: string): Locator {
        return this.dialog().getByRole('radio', { name: new RegExp(label) });
    }

    /** The "Open this view by default" checkbox. */
    makeDefault(): Locator {
        return this.dialog().getByRole('checkbox');
    }

    /** The dialog's submit. */
    submit(): Locator {
        return this.dialog().getByRole('button', { name: 'Save view' });
    }

    /** The dialog's captured-summary block. */
    capturedSummary(): Locator {
        return this.dialog().getByText('Saved:', { exact: true });
    }
}
