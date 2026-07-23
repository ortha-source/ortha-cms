import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { mockMediaApi } from '../support/api/media';
import { expectNoA11yViolations } from '../support/a11y';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/**
 * The Media Library wired to the (mocked) media API: browsing seeded folders +
 * assets, uploading a file, creating a folder, the permission gate, and an axe
 * scan. Backend is stubbed at the network layer by `mockMediaApi`.
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
