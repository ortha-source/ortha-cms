import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Escapes a string for use inside a `RegExp`. */
const escapeRegExp = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Page object for the Media Library at `/workspaces/:id/media` (from
 * `@orthacms/media-admin`) — the folder tree, the file browser (grid or list),
 * the details panel, and the New-folder / Upload flows. Seed it with
 * `mockSignedIn`, `mockWorkspaces`, and `mockMediaApi`.
 */
export class MediaLibraryPage extends BasePage {
    constructor(page: Page) {
        super(page);
    }

    /** Navigate straight to a workspace's Media Library. */
    async goto(workspaceId: string) {
        await this.page.goto(`/workspaces/${workspaceId}/media`);
    }

    /** The page heading ("Media Library" at the root). */
    heading(): Locator {
        return this.page.getByRole('heading', { name: 'Media Library' });
    }

    /** An asset tile by file name (its "Open {name}" button). */
    assetTile(name: string): Locator {
        return this.page.getByRole('button', { name: `Open ${name}` });
    }

    /**
     * A folder's row in the tree, by name. Folders are drawn in the tree
     * alone (the grid shows files), and the row's button reads "{name} {n}
     * items" — anchored so a folder called "Images" doesn't also match its
     * "Toggle Images" chevron or a sibling named "Images 2".
     */
    folderTile(name: string): Locator {
        return this.page
            .getByRole('navigation', { name: 'Folders' })
            .getByRole('button', {
                name: new RegExp(`^${escapeRegExp(name)}\\s*\\d+ items?$`)
            });
    }

    // --- browse controls ---

    /** A type chip ("All", "Images", "Documents", …). */
    typeChip(label: string): Locator {
        return this.page
            .getByRole('group', { name: 'Filter by type' })
            .getByRole('button', { name: label, exact: true });
    }

    /** Pick a sort order from the toolbar's select. */
    async sortBy(label: string) {
        await this.page.getByRole('combobox', { name: 'Sort' }).click();
        await this.page.getByRole('option', { name: label }).click();
    }

    /** The Grid / List switch's item ("Grid view" / "List view"). */
    viewSwitch(label: 'Grid view' | 'List view'): Locator {
        return this.page.getByLabel(label, { exact: true });
    }

    /** The list view's table. */
    filesTable(): Locator {
        return this.page.getByRole('table', { name: 'Files' });
    }

    /** The dark bar raised by a selection. */
    get selectionBar(): Locator {
        return this.page.getByRole('group', { name: 'Selection' });
    }

    /** The no-access message shown without `media:read`. */
    noAccess(): Locator {
        return this.page.getByText(/permission to view the media library/);
    }

    /** A toast by its text (sonner posts into the shell's live region). */
    toast(text: string | RegExp): Locator {
        return this.page.getByText(text);
    }

    /**
     * The focusable region wrapping the folder/asset grid. A destructive action
     * hands focus here, since the ⋯ trigger it was restored to no longer exists.
     */
    assetsRegion(): Locator {
        return this.page.getByRole('region', { name: 'Assets' });
    }

    // --- asset actions ---

    /**
     * The per-asset "⋯" menu trigger, named after its file — a grid of tiles
     * would otherwise offer N buttons all called "Asset actions".
     */
    assetActions(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** Open an asset's menu and choose an item. */
    async assetAction(name: string, item: string) {
        await this.assetActions(name).click();
        await this.page.getByRole('menuitem', { name: item }).click();
    }

    /** Rename an asset through its ⋯ menu. */
    async renameAsset(name: string, to: string) {
        await this.assetAction(name, 'Rename');
        // `getByLabel('Name')` also matches the dialog itself, whose accessible
        // name is "Rename". Anchor on the textbox role.
        await this.page.getByRole('textbox', { name: 'Name' }).fill(to);
        await this.page.getByRole('button', { name: 'Save' }).click();
    }

    /** Delete an asset through its ⋯ menu, confirming the dialog. */
    async deleteAsset(name: string) {
        await this.assetAction(name, 'Delete');
        await this.confirmDelete();
    }

    // --- details panel ---

    /** Open an asset's details panel from its tile (or list row). */
    async openDetail(name: string) {
        await this.assetTile(name).click();
    }

    /**
     * The details panel, a region named after the file it shows. Pass no name
     * for whichever file is open.
     */
    detailPanel(name?: string): Locator {
        if (name) return this.page.getByRole('region', { name, exact: true });
        return this.page.getByRole('region').filter({
            has: this.page.getByRole('button', { name: 'Next file' })
        });
    }

    /** The panel's alt-text input (present for an image with `media:update`). */
    altInput(): Locator {
        return this.page.getByRole('textbox', { name: 'Alt text' });
    }

    /** Save the panel's alt text. */
    async saveAlt(text: string) {
        await this.altInput().fill(text);
        await this.page.getByRole('button', { name: 'Save alt text' }).click();
    }

    // --- upload banner ---

    /** The upload tray (bottom-right). */
    uploadBanner(): Locator {
        return this.page.getByRole('region', { name: 'Uploads' });
    }

    /** The alt input on a staged file in the upload dialog. */
    stagedAltInput(fileName: string): Locator {
        return this.page.getByRole('textbox', {
            name: `Alt text for ${fileName}`
        });
    }

    // --- upload ---

    /** The hidden file input inside the upload dialog. */
    fileInput(): Locator {
        return this.page.locator('input[type="file"]');
    }

    /** Open the upload dialog (the top bar's Upload). */
    async openUpload() {
        await this.page
            .getByRole('button', { name: 'Upload', exact: true })
            .first()
            .click();
    }

    /** Stage a file and confirm the upload, optionally describing it first. */
    async uploadFile(
        file: { name: string; mimeType: string; buffer: Buffer },
        alt?: string
    ) {
        await this.fileInput().setInputFiles(file);
        if (alt !== undefined) await this.stagedAltInput(file.name).fill(alt);
        await this.page
            .getByRole('button', { name: /^Upload \d+ file/ })
            .click();
    }

    // --- folder actions ---

    /**
     * The per-folder "⋯" menu trigger on the folder's tree row. Named after
     * its folder ("Actions for Images"), so it needs no positional scoping —
     * and a screen-reader user isn't handed a row of identical "Folder
     * actions" buttons.
     */
    folderActions(name: string): Locator {
        return this.page.getByRole('button', { name: `Actions for ${name}` });
    }

    /** Open a folder's menu and choose Delete — stops at the confirmation. */
    async startDeleteFolder(name: string) {
        await this.folderActions(name).click();
        await this.page.getByRole('menuitem', { name: 'Delete' }).click();
    }

    /**
     * The open confirm dialog (a plain `dialog` — the design-system
     * `ConfirmDialog` builds on `Dialog`, not `AlertDialog`). Its title varies
     * with what the folder holds, so match on the heading role, not the text.
     */
    get confirmDialog(): Locator {
        return this.page.getByRole('dialog');
    }

    /** Confirm the pending destructive action. */
    async confirmDelete() {
        await this.confirmDialog
            .getByRole('button', { name: 'Delete', exact: true })
            .click();
    }

    // --- new folder ---

    /** Run the create-folder flow end to end. */
    async createFolder(name: string) {
        await this.page
            .getByRole('button', { name: 'New folder' })
            .first()
            .click();
        await this.page.getByLabel('Folder name').fill(name);
        await this.page.getByRole('button', { name: 'Create folder' }).click();
    }
}
