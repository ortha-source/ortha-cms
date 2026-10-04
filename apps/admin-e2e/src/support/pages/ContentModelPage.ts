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
    /** The Content model entry in the primary nav. */
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
            name: 'Content model',
            level: 1
        });
        this.navLink = page
            .getByRole('navigation', { name: 'Primary' })
            .getByRole('link', { name: 'Content model' });
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

    /** The "Add a field" dialog. */
    addFieldDialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Add a field' });
    }

    /** One field type tile in the dialog. */
    fieldTypeTile(label: string): Locator {
        return this.addFieldDialog().getByRole('radio', { name: label });
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

    /** The review drawer. */
    changesDrawer(): Locator {
        return this.page.getByRole('dialog', { name: 'Review changes' });
    }

    /** The drawer's Apply. */
    applyChangesButton(): Locator {
        return this.changesDrawer().getByRole('button', { name: 'Apply' });
    }

    /** The apply's progress panel. */
    applyProgress(): Locator {
        return this.page.getByRole('region', {
            name: 'Applying the content model'
        });
    }

    /** The after-apply offer to grant a new type to workspaces. */
    grantDialog(): Locator {
        return this.page.getByRole('dialog', {
            name: /^Use the new types? in workspaces$/
        });
    }

    /** Adds a collection from the rail, by its label. */
    async addType(label: string): Promise<void> {
        await this.newTypeButton().click();
        const dialog = this.page.getByRole('dialog', {
            name: 'New content type'
        });
        await dialog.getByLabel('Label').fill(label);
        await dialog.getByRole('button', { name: 'Add type' }).click();
    }

    /** The empty state's heading. */
    emptyHeading(): Locator {
        return this.page.getByRole('heading', { name: 'No content types yet' });
    }
}
