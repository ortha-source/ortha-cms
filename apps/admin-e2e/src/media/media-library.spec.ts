import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockMediaApi } from '../support/api/media';
import { expectNoA11yViolations } from '../support/a11y';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/**
 * The Media Library wired to the (mocked) media API: browsing seeded folders +
 * assets, uploading a file, creating a folder, the type chips, the list view,
 * the details panel's keyboard, the permission gate, and axe scans. Backend is stubbed at the network layer by `mockMediaApi`.
 */
test.describe('Media Library', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('renders the workspace folders and assets', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);

        await expect(mediaLibraryPage.heading()).toBeVisible();
        await expect(mediaLibraryPage.folderTile('Images')).toBeVisible();
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();
        await expect(mediaLibraryPage.assetTile('report.pdf')).toBeVisible();
    });

    test('uploads a file and shows it in the grid', async ({
        page,
        mediaLibraryPage
    }) => {
        const spy = await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.openUpload();
        await mediaLibraryPage.uploadFile({
            name: 'brand-new.png',
            mimeType: 'image/png',
            buffer: Buffer.from('fake-png')
        });

        await expect.poll(() => spy.count).toBeGreaterThan(0);
        await expect(mediaLibraryPage.assetTile('brand-new.png')).toBeVisible();
    });

    test('creates a folder', async ({ page, mediaLibraryPage }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);

        await mediaLibraryPage.createFolder('Campaigns');

        await expect(mediaLibraryPage.folderTile('Campaigns')).toBeVisible();
    });

    test('warns that deleting a folder takes its contents with it', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);

        // The seeded "Images" folder holds one asset — the confirmation has to
        // say so, because the delete cascades.
        await mediaLibraryPage.startDeleteFolder('Images');

        await expect(mediaLibraryPage.confirmDialog).toContainText(
            'and everything inside'
        );
        await expect(mediaLibraryPage.confirmDialog).toContainText('1 asset');

        await mediaLibraryPage.confirmDelete();
        await expect(mediaLibraryPage.folderTile('Images')).toBeHidden();
    });

    test('says a folder is empty when it holds nothing', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.createFolder('Scratch');

        await mediaLibraryPage.startDeleteFolder('Scratch');

        // No inventory to recite — the prompt shouldn't imply there is one.
        await expect(mediaLibraryPage.confirmDialog).toContainText(
            'This folder is empty'
        );
        await expect(mediaLibraryPage.confirmDialog).not.toContainText(
            'everything inside'
        );
    });

    test('filters by type from the chips', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.typeChip('Documents').click();

        await expect(mediaLibraryPage.typeChip('Documents')).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(mediaLibraryPage.assetTile('report.pdf')).toBeVisible();
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeHidden();
    });

    test('shows the files as a table, and remembers the choice', async ({
        page,
        mediaLibraryPage,
        makeAxe
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.viewSwitch('List view').click();

        const table = mediaLibraryPage.filesTable();
        await expect(table).toContainText('hero.png');
        await expect(table).toContainText('report.pdf');

        // The header checkbox takes the whole page into the selection.
        await table
            .getByRole('checkbox', { name: 'Select all files on this page' })
            .click();
        await expect(mediaLibraryPage.selectionBar).toContainText('2 selected');
        await expectNoA11yViolations(makeAxe());

        await page.reload();
        await expect(mediaLibraryPage.filesTable()).toBeVisible();
    });

    test('steps through files in the details panel and closes on Escape', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.sortBy('Name A–Z');
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.openDetail('hero.png');
        await expect(mediaLibraryPage.detailPanel('hero.png')).toBeVisible();
        // Non-modal: the grid stays usable beside it.
        await expect(mediaLibraryPage.assetTile('report.pdf')).toBeVisible();

        await page.keyboard.press('ArrowRight');
        await expect(mediaLibraryPage.detailPanel('report.pdf')).toBeVisible();
        await page.keyboard.press('ArrowLeft');
        await expect(mediaLibraryPage.detailPanel('hero.png')).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(mediaLibraryPage.detailPanel('hero.png')).toBeHidden();
        // Focus goes back to the tile that opened it.
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeFocused();
    });

    test('shows a no-access state without media:read', async ({
        page,
        mediaLibraryPage
    }) => {
        // A later registration wins, so this narrows the beforeEach session to a
        // user with no permissions.
        await mockSignedIn(page, { permissions: [] });
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);

        await expect(mediaLibraryPage.noAccess()).toBeVisible();
        await expect(mediaLibraryPage.folderTile('Images')).toBeHidden();
    });

    test('has no accessibility violations', async ({
        page,
        mediaLibraryPage,
        makeAxe
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
