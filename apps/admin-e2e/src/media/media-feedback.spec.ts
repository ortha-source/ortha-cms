import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { failAssetPatch, mockMediaApi } from '../support/api/media';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

/** A tiny PNG body; the upload mock only reads the multipart headers. */
const PNG = {
    name: 'brand-new.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-png')
};

/**
 * What the Media Library **tells** the user after an action.
 *
 * Two defects are pinned here, both found by watching the live app:
 *
 * 1. Every confirmation fired at *dispatch* time, so a rename the server
 *    rejected produced "Renamed to “a/b.txt”" **and** an error side by side.
 * 2. Failures showed `ApiError.message` — the transport's "Request failed with
 *    status code 400" — while the API's own sentence sat unread in the response
 *    body. The 413 case matters most: media-server words that one specifically
 *    ("File exceeds the maximum upload size.") and nothing was reading it.
 */
test.describe('Media Library feedback', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('shows the API’s own message when a rename is rejected', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await failAssetPatch(page, {
            status: 400,
            message: 'Invalid file name: a/b.png'
        });
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.renameAsset('hero.png', 'a/b.png');

        await expect(
            mediaLibraryPage.toast('Invalid file name: a/b.png')
        ).toBeVisible();
        // Not the transport's description of the failure.
        await expect(
            mediaLibraryPage.toast(/Request failed with status/)
        ).toBeHidden();
    });

    test('does not confirm a rename the server refused', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await failAssetPatch(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.renameAsset('hero.png', 'a/b.png');

        await expect(mediaLibraryPage.toast(/Invalid file name/)).toBeVisible();
        await expect(mediaLibraryPage.toast(/^Renamed to/)).toBeHidden();
    });

    test('confirms a rename the server accepted', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.renameAsset('hero.png', 'banner.png');

        await expect(
            mediaLibraryPage.toast('Renamed to “banner.png”')
        ).toBeVisible();
    });

    test('puts the server’s reason on a failed upload row', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page, { uploadStatus: 413 });
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.openUpload();
        await mediaLibraryPage.uploadFile(PNG);

        await expect(mediaLibraryPage.uploadBanner()).toContainText(
            'That file is too large to upload.'
        );
    });

    test('announces which file failed, not just the batch count', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page, { uploadStatus: 413 });
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.openUpload();
        await mediaLibraryPage.uploadFile(PNG);

        // The headline's live region only ever moves a count; the per-file
        // reason lives in its own polite region so it is spoken at all.
        await expect(
            mediaLibraryPage
                .uploadBanner()
                .getByText(
                    'brand-new.png failed to upload. That file is too large to upload.'
                )
        ).toBeAttached();
    });

    test('moves focus to the grid after deleting the tile that opened the menu', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.deleteAsset('hero.png');

        await expect(mediaLibraryPage.assetTile('hero.png')).toBeHidden();
        // Restoration would target the detached ⋯ trigger and land on <body>,
        // stranding a keyboard user at the top of the document.
        await expect(mediaLibraryPage.assetsRegion()).toBeFocused();
    });

    test('names each asset’s ⋯ trigger after its file', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);

        await expect(mediaLibraryPage.assetActions('hero.png')).toBeVisible();
        await expect(mediaLibraryPage.assetActions('report.pdf')).toBeVisible();
    });
});
