import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page object for the Media Library at `/workspaces/:id/media` (from
 * `@ortha-cms/media-admin`) — the folders sidebar, the asset browser (grid), and
 * the New-folder / Upload flows. Seed it with `mockSignedIn`, `mockWorkspaces`,
 * and `mockMediaApi`.
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

    /** A folder tile by name (its "Open folder {name}" button). */
    folderTile(name: string): Locator {
        return this.page.getByRole('button', { name: `Open folder ${name}` });
    }

    /** The no-access message shown without `media:read`. */
    noAccess(): Locator {
        return this.page.getByText(/permission to view the media library/);
    }

    // --- upload ---

    /** The hidden file input inside the upload dialog. */
    fileInput(): Locator {
        return this.page.locator('input[type="file"]');
    }

    /** Open the upload dialog. */
    async openUpload() {
        await this.page.getByRole('button', { name: 'Upload' }).first().click();
    }

    /** Stage a file and confirm the upload. */
    async uploadFile(file: { name: string; mimeType: string; buffer: Buffer }) {
        await this.fileInput().setInputFiles(file);
        await this.page
            .getByRole('button', { name: /^Upload \d+ file/ })
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
        await this.page
            .getByRole('button', { name: 'Create folder' })
            .click();
    }
}
