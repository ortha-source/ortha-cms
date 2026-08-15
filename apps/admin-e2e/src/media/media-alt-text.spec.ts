import { expect, test } from '../support/fixtures';
import { mockSignedIn } from '../support/api/auth';
import { mockWorkspaces } from '../support/api/workspaces';
import { MEDIA_HERO_ALT, mockMediaApi } from '../support/api/media';
import { expectNoA11yViolations } from '../support/a11y';

/** The workspace the suite opens (from the workspaces mock's default seed). */
const WORKSPACE_ID = 'ws_marketing';

const PNG = {
    name: 'brand-new.png',
    mimeType: 'image/png',
    buffer: Buffer.from('fake-png')
};

/**
 * Alt text has to be **reachable**. `media_asset.alt` has always been a real
 * column and the Insights card has always counted the images missing one — but
 * the admin had no way to write it: the drawer printed `asset.alt` as prose,
 * and only when it was already set, so an image that landed undescribed stayed
 * undescribed forever. WCAG 1.1.1 (Non-text Content).
 *
 * Two routes are pinned: at upload, while the author is still looking at the
 * picture, and afterwards from the asset's own drawer.
 */
test.describe('Media alt text', () => {
    test.beforeEach(async ({ page }) => {
        await mockSignedIn(page);
        await mockWorkspaces(page);
    });

    test('sends alt written at upload with the file', async ({
        page,
        mediaLibraryPage
    }) => {
        const spy = await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.openUpload();
        await mediaLibraryPage.uploadFile(PNG, 'A blue product banner');

        await expect.poll(() => spy.alts).toEqual(['A blue product banner']);
        await expect(mediaLibraryPage.assetTile('brand-new.png')).toBeVisible();
    });

    test('leaves alt off the request when the author skips it', async ({
        page,
        mediaLibraryPage
    }) => {
        const spy = await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await expect(mediaLibraryPage.assetTile('hero.png')).toBeVisible();

        await mediaLibraryPage.openUpload();
        // An empty description must not be sent: the server would normalize it
        // away, but a blank part reads as "described" to anything auditing.
        await mediaLibraryPage.uploadFile(PNG, '   ');

        await expect.poll(() => spy.alts).toEqual([null]);
    });

    test('offers no alt input for a non-image', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.openUpload();

        await mediaLibraryPage.fileInput().setInputFiles({
            name: 'notes.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('hello')
        });

        await expect(mediaLibraryPage.stagedAltInput('notes.txt')).toBeHidden();
    });

    test('edits an existing asset’s alt text from its drawer', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.openDetail('hero.png');

        await expect(mediaLibraryPage.altInput()).toHaveValue(MEDIA_HERO_ALT);
        await mediaLibraryPage.saveAlt('A crowd outside the new office');

        await expect(mediaLibraryPage.toast('Alt text saved')).toBeVisible();
        // The grid re-reads it, so the tile's <img> carries the new text.
        await expect(
            page.getByAltText('A crowd outside the new office').first()
        ).toBeVisible();
    });

    test('shows alt read-only without media:update', async ({
        page,
        mediaLibraryPage
    }) => {
        await mockSignedIn(page, { permissions: ['media:read'] });
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.openDetail('hero.png');

        await expect(page.getByText(MEDIA_HERO_ALT)).toBeVisible();
        await expect(mediaLibraryPage.altInput()).toBeHidden();
    });

    test('has no accessibility violations with the drawer open', async ({
        page,
        mediaLibraryPage,
        makeAxe
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.openDetail('hero.png');
        await expect(mediaLibraryPage.altInput()).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });

    test('has no accessibility violations with a file staged for upload', async ({
        page,
        mediaLibraryPage,
        makeAxe
    }) => {
        await mockMediaApi(page);
        await mediaLibraryPage.goto(WORKSPACE_ID);
        await mediaLibraryPage.openUpload();
        await mediaLibraryPage.fileInput().setInputFiles(PNG);
        await expect(mediaLibraryPage.stagedAltInput(PNG.name)).toBeVisible();

        await expectNoA11yViolations(makeAxe());
    });
});
